const statusCode = require("../json/statusCode.json");

class core {
  #keyFinder(obj, key) {
    const m = Object.keys(obj).find((i) => {
      return i == key;
    });
    return { key: m, value: obj[m] };
  }

  #keys = (i) => this.#keyFinder(statusCode, i).key;
  #values = (i) => this.#keyFinder(statusCode, i).value;

  apiResponse(i, data) {
    return {
      data: data,
      status: i == "OK" || "Created" ? true : false,
      statusCode: this.#values(i),
      msg: this.#keys(i),
    };
  }
}

module.exports = core;
