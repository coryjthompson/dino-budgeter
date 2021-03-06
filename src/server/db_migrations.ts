import _ from "lodash";
import Money from "../shared/Money";
import * as util from "../shared/util";
import db from "./db";

// Add all migrations here to run them
// They must be idempotent
export async function runMigrations() {
  await migrateAddFriendshipBalance();
  await migrateAddPaymentId();
}

async function migrateAddFriendshipBalance() {
  await db.tx(async (t) => {
    const rows = await t.manyOrNone(`
        select M.uid, M2.uid as other_uid, ST.id as sid, T2.amount as other_amount from transaction_splits TS
        left join shared_transactions ST on ST.id = TS.sid
        left join transactions T on T.id = TS.tid
        left join membership M on M.gid = T.gid
        left join transaction_splits TS2 on TS.sid = TS2.sid and TS.tid != TS2.tid
        left join transactions T2 on TS2.tid = T2.id
        left join membership M2 on T2.gid = M2.gid
        where
          ST.settled = false and
          T.alive = true and
          M.uid = ST.payer`);
    const balances: { [uid: string]: { [uid: string]: Money } } = {};
    const work: Array<Promise<any>> = [];
    rows.forEach((row) => {
      // balance: u1 owes u2.
      const owed = new Money(row.other_amount);
      const payer = row.uid;
      const [u1, u2] = [row.uid, row.other_uid].sort();
      const u1_owes_u2 = payer === u1 ? owed.negate() : owed;
      if (balances[u1] === undefined) {
        balances[u1] = {};
      }
      if (balances[u1][u2] === undefined) {
        balances[u1][u2] = Money.Zero;
      }
      balances[u1][u2] = balances[u1][u2].plus(u1_owes_u2);
      work.push(
        t.none(`update shared_transactions set settled = true where id = $1`, [
          row.sid,
        ]),
      );
    });
    _.forEach(balances, (u2s, u1) => {
      _.forEach(u2s, (balance, u2) => {
        console.log(
          `Migrating balance: ${u1} owes ${u2} ${balance.formatted()}`,
        );
        work.push(
          t.none(
            `update friendship set balance = $1 where u1 = $2 and u2 = $3`,
            [balance.string(), u1, u2],
          ),
        );
      });
    });
    await t.batch(work);
  });
}

async function migrateAddPaymentId() {
  let totalRows = 0;
  let expectedRows = 0;
  await db.tx(async (t) => {
    const rows = await t.manyOrNone(
      "select round(extract(epoch from ctime)) as epoch from payments where id is null",
    );
    expectedRows = rows.length;
    await t.batch(
      rows.map(async (row) => {
        const args = [util.randomId(), row.epoch];
        const result = await t.result(
          `update payments set id = $1
          where round(extract(epoch from ctime)) = $2`,
          args,
        );
        totalRows += result.rowCount;
        if (result.rowCount !== 1) {
          console.warn(
            `Migration to add IDs to payments got an unexpected result: an update affected ${result.rowCount} rows.`,
          );
        }
      }),
    );
  });
  if (expectedRows !== totalRows) {
    console.warn(
      `Expected to affect ${expectedRows} rows but affected ${totalRows} rows!`,
    );
  }
  if (totalRows > 0) {
    console.log(`Migration added ID to ${totalRows} payments`);
  }
}
