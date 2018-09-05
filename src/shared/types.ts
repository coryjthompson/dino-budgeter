import BigNumber from 'bignumber.js';

export type UserId = string;
export type GroupId = string;
export type CategoryId = string;
export type FrameIndex = number;
export type TransactionId = string;

// Corresponds to `users` db table
export interface User {
    uid: UserId;
    email: string;
    password_hash: string;
}

export class Money {
    private num: BigNumber;
    constructor(value: BigNumber.Value) {
        this.num = new BigNumber(value);
    }
    static Zero = new Money(0);
    static sum(ms: Money[]): Money {
        console.log("will sum", ms);
        return ms.reduce((a: Money, b: Money) => {
            if (!b.isValid()) {
                throw new Error("this is not a good money:" + b.toJSON());
            }
            return a.plus(b);
        }, Money.Zero);
    }
    string(): string {
        return this.num.toFixed(2);
    }
    toJSON(): string {
        return this.string();
    }
    formatted(): string {
        const money = this.string();
        let dollars = money;
        let cents = "00";
        if (money.indexOf(".") > -1) {
            [dollars, cents] = money.split(".");
        }
        if (cents.length < 2) {
            cents = cents + "0";
        }
        return "$" + dollars + "." + cents;
    }
    plus(other: Money): Money {
        return new Money(this.num.plus(other.num));
    }
    minus(other: Money): Money {
        return new Money(this.num.minus(other.num));
    }
    cmp(other: Money): number {
        return this.num.comparedTo(other.num);
    }
    negate(): Money {
        return new Money(this.num.times(-1));
    }

    isValid(allowNegative: boolean = true): boolean {
        if (!this.num.isFinite()) {
            return false;
        }
        if (!allowNegative && this.num.isNegative()) {
            return false;
        }
        return true;
    }
}

// Corresponds to `categories` db table, plus `balance`
export interface Category {
    id: CategoryId;
    gid: GroupId;
    frame: FrameIndex;
    alive: boolean;
    name: string;
    ordering: number;
    budget: Money;
    balance?: Money;
}

// Corresponds to `frames` db table joined on `categories`, plus `balance` and `spending`
export interface Frame {
    gid: GroupId;
    index: FrameIndex;
    income: Money;
    categories?: Category[];
    balance?: Money;
    spending?: Money;
}

// Corresponds to `transactions` db table
export interface Transaction {
    id: TransactionId;
    gid: GroupId;
    frame: FrameIndex;
    category: CategoryId | null;
    amount: Money;
    description: string;
    alive: boolean;
    date: Date;
}