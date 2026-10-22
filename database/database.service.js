const { mongoUrl } = require("../provider/config.map");
const { MongoClient } = require("../provider/dependency.map");

class databaseService {
  #url = mongoUrl;
  client;

  constructor() {
    this.client = new MongoClient(this.#url);
  }

  connect = async () => await this.client.connect();

  getDb = (dbName) => this.client.db(dbName);
}

module.exports = databaseService;
