import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import * as frames from '../shared/frames'
import { MONTHS } from './util';

type Props = RouteComponentProps<{month: string, year: string}>;

type State = {
    kind: "loading"
} | {
    kind: "error"
    message: string
} | {
    kind: "loaded"
    transactions: any[]
};

export default class Transactions extends React.Component<Props, State> {
    private month: number;
    private monthName: string;
    state: State = {
        kind: "loading",
    }

    constructor(props: Props) {
        super(props);
        this.month = Number(props.match.params.month) - 1;
        this.monthName = MONTHS[this.month];
    }

    setStateStrict(state: Readonly<State>): void {
        this.setState((prevState, props) => {
            return state
        })
    }

    componentDidMount() {
        this.init().catch(err => {
            console.error("initializing transactions", err);
            this.setStateStrict({
                kind: "error",
                message: err.toString(),
            })
        })
    }

    async init() {
        const month = this.month;
        const year = Number(this.props.match.params.year);
        const frame = frames.index(month, year);
        const res = await fetch("/api/transactions?frame=" + frame);
        if (res.status != 200) {
            throw new Error(`status ${res.status}`)
        }
        const payload = await res.json();
        const txns = payload.transactions.map((tx: any) => {
            tx.date = new Date(tx.date);
            return tx;
        });
        this.setStateStrict({
            kind: "loaded",
            transactions: txns,
        });
    }
    
    render() {
        switch (this.state.kind) {
        case "loading":
            return <div>Loading...</div>
        case "error":
            return <div>Failed: {this.state.message}</div>
        case "loaded":
            return this.renderTransactions(this.state.transactions);
        default:
            return <div>Invalid case {(this.state as any).kind}</div>
        }
    }

    formatDate(d: Date): string {
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    }

    renderTransactions(transactions: any[]) {
        const rows = transactions.map((tx) => {
            return <tr key={tx.id}><td>{this.formatDate(tx.date)}</td><td>{tx.description}</td><td>{tx.amount}</td></tr>;
        });
        return <div>
            <h1>{this.monthName + ' ' + this.props.match.params.year}</h1>
            <h2>Transactions</h2>
            <table><tbody>
            {rows}
            </tbody></table>
        </div>;
    }
}
