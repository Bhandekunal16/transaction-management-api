const database = require("./database.service");
const {
  mongoDbName,
  collection,
  transactionsFlow,
  SMTP_SEND_URL,
} = require("../provider/config.map");
const { qr } = require("../provider/dependency.map");

class userService {
  #db;
  #client;
  transporter;
  #SMTP_SEND_URL = SMTP_SEND_URL;

  constructor() {
    this.#db = new database();
    this.#client = this.#db.client;
  }

  #database = async () => {
    return this.#db.getDb(mongoDbName);
  };

  #collectionJoin = async (name) => {
    return (await this.#database()).collection(name);
  };

  user = async () => {
    return await this.#collectionJoin(collection.user);
  };

  payment = async () => {
    return await this.#collectionJoin(collection.transactions);
  };

  budget = async () => {
    return await this.#collectionJoin(collection.budgets);
  };

  async create(data) {
    try {
      const usersCollection = await this.user();
      return await usersCollection.insertOne(data);
    } catch (e) {
      console.log(e.message);
    }
  }

  async addBudget(data) {
    try {
      const budgets = await this.budget();
      return await budgets.insertOne(data);
    } catch (e) {
      console.log(e.message);
    }
  }

  async userPayment(data) {
    try {
      const paymentCollection = await this.payment();
      const user = await this.user();
      const x = await paymentCollection.insertOne(data);

      const y = await user.findOne({ username: data.username });

      const obj = y.accounts.find((i) => i.bankName === data.bankName);

      data.type == "debit"
        ? (obj.balance = obj.balance - parseFloat(data.transactionAmount))
        : (obj.balance = obj.balance + parseFloat(data.transactionAmount));

      await user.findOneAndUpdate(
        {
          username: data.username,
          "accounts.bankName": obj.bankName,
        },
        {
          $set: { "accounts.$.balance": obj.balance },
        },
        { returnDocument: "after" },
      );

      return x;
    } catch (e) {
      console.log(e.message);
    }
  }

  async get(body) {
    try {
      const userCollection = await this.user();
      console.log(userCollection, 0);
      return await userCollection.findOne(body);
    } catch (e) {
      console.log(e.message);
    }
  }

  async getMonthlySpends(body) {
    try {
      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).getTime();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ).getTime();

      const txn = await this.payment();
      const x = await txn
        .find({
          username: body.username,
          time: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        })
        .toArray();

      const y = x.map((i) => {
        return i.type == "debit" ? i.transactionAmount : 0;
      });

      return y.reduce((sum, num) => sum + num, 0);
    } catch (e) {
      console.log(e.message);
    }
  }

  async getTxn(body) {
    try {
      const txn = await this.payment();
      return await txn.find(body).sort({ time: -1 }).toArray();
    } catch (e) {
      console.log(e.message);
    }
  }

  async getBudget(body) {
    try {
      const txn = await this.budget();
      return await txn.find(body).toArray();
    } catch (e) {
      console.log(e.message);
    }
  }

  async updateBudget(data) {
    try {
      const budget = await this.budget();
      return await budget.findOneAndUpdate(
        {
          username: data.username,
        },
        {
          $set: { amount: data.amount },
        },
        { returnDocument: "after" },
      );
    } catch (e) {
      console.log(e.message);
    }
  }

  async updateUser(data) {
    try {
      const user = await this.user();
      return await user.findOneAndUpdate(
        {
          username: data.username,
        },
        {
          $set: { "accounts.0.vpa": data.vpa },
        },
        { returnDocument: "after" },
      );
    } catch (e) {
      console.log(e.message);
    }
  }

  async getTxnDataTimeWise(body) {
    try {
      const txn = await this.payment();
      const data = await txn.find(body).toArray();

      let dates = data.map((i) => {
        return i.time;
      });

      dates = dates.map((ts) => {
        return new Date(ts).toDateString();
      });

      const grouped = data.reduce((acc, tx) => {
        const dateKey = new Date(tx.time).toDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(tx);
        return acc;
      }, {});

      const summary = {
        totalCreditCount: data.filter((i) => i.type === transactionsFlow.credit)
          .length,
        totalDebitCount: data.filter((i) => i.type === transactionsFlow.debit)
          .length,
        totalCreditAmount: data
          .filter((i) => i.type === transactionsFlow.credit)
          .reduce((sum, i) => sum + i.transactionAmount, 0),
        totalDebitAmount: data
          .filter((i) => i.type === transactionsFlow.debit)
          .reduce((sum, i) => sum + i.transactionAmount, 0),
        date: [...new Set(dates)],
        dateWise: grouped,
      };

      return summary;
    } catch (e) {
      console.log(e.message);
      throw e;
    }
  }

  async sendDailyReport() {
    try {
      const userModel = await this.user();
      const userList = await userModel.find().toArray();

      const users = userList.map((i) => ({
        name: i.name,
        mobile: i.mobile,
        email: i.email,
        username: i.username,
        accounts: i.accounts,
      }));

      const [THIRTY_DAYS_MS, now] = [30 * 24 * 60 * 60 * 1000, Date.now()];

      for (let i = 0; i < users.length; i++) {
        const txnData = await this.getTxnDataTimeWise({
          username: users[i].username,
        });

        const [filteredDateWise, filteredDates] = [{}, []];

        txnData.date.forEach((dateStr) => {
          const txns = txnData.dateWise[dateStr].filter(
            (t) => now - t.time <= THIRTY_DAYS_MS,
          );
          if (txns.length > 0) {
            filteredDateWise[dateStr] = txns;
            filteredDates.push(dateStr);
          }
        });

        users[i].txn = {
          ...txnData,
          date: filteredDates,
          dateWise: filteredDateWise,
        };
      }

      await this.sendDailyReportEmail(users);

      return users;
    } catch (e) {
      console.log(e.message);
    }
  }

  async getUpiQr(body) {
    try {
      const user = await this.get({ username: body.username });
      const upiString = [];

      for (const i of user.accounts) {
        const upiUrl = body.Amount
          ? `upi://pay?pa=${i.vpa}&pn=${encodeURIComponent(user.name)}&am=${
              body.Amount
            }&cu=INR`
          : `upi://pay?pa=${i.vpa}&pn=${encodeURIComponent(user.name)}&cu=INR`;

        const qrDataUrl = await qr.toDataURL(upiUrl);

        upiString.push({
          url: qrDataUrl,
          vpa: i.vpa,
          bankName: i.bankName,
        });
      }

      return upiString;
    } catch (e) {
      console.log(e.message);
      return { data: [], status: false, statusCode: 500, msg: e.message };
    }
  }

  generateUserHtml(user) {
    const accountsTable = `
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 10px;">
        <tr>
          <th>Type</th>
          <th>Bank Name</th>
          <th>Account Number</th>
          <th>Balance</th>
        </tr>
        ${user.accounts
          .map(
            (acc) => `
          <tr>
            <td>${acc.type}</td>
            <td>${acc.bankName}</td>
            <td>${acc.number}</td>
            <td>${acc.balance.toFixed(2)}</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    `;

    const txnTables = user.txn.date
      .map((date) => {
        const transactions = user.txn.dateWise[date];
        return `
          <h4>${date}</h4>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-bottom: 15px;">
            <tr>
              <th>Bank</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Description</th>
              <th>Category</th>
            </tr>
            ${transactions
              .map(
                (t) => `
              <tr>
                <td>${t.bankName}</td>
                <td>${t.type}</td>
                <td>${t.transactionAmount.toFixed(2)}</td>
                <td>${t.transactionDesc}</td>
                <td>${t.categories || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </table>
        `;
      })
      .join("");

    return `
      <h3>${user.name} (${user.username})</h3>
      <p>Email: ${user.email} | Mobile: ${user.mobile}</p>
      <strong>Accounts:</strong>
      ${accountsTable}
      <strong>Transactions:</strong>
      ${txnTables}
      <hr/>
    `;
  }

  async sendDailyReportEmail(users) {
    try {
      for (let u = 0; u < users.length; u++) {
        await this.sendEmail({
          to: users[u].email,
          subject: "Daily User Transaction Report",
          text: `hello ${users[u].name}`,
          html: this.generateUserHtml(users[u]),
        });
      }
    } catch (e) {
      console.error("Error sending report:", e.message);
      throw e;
    }
  }

  async sendEmail({ to, subject, text, html }) {
    const payload = {
      to,
      subject,
      text,
      html,
    };

    const response = await fetch(this.#SMTP_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_SECONDS * 1000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Email API request failed: ${response.status} ${response.statusText}\n${errorBody}`,
      );
    }

    console.log(response, 0);

    let result;
    const responseText = await response.text();

    try {
      result = JSON.parse(responseText);
      console.log(result, 1);
    } catch {
      result = responseText;
    }

    console.log("Email API response:", result);

    return result;
  }
}

module.exports = userService;
