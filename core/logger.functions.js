const { colors, logType } = require("../provider/config.map");

class Logger {
  #logType = logType;
  #colors = colors;

  #print = (type, input) => {
    const timestamp = new Date().toISOString();

    const formatted = `\x1b[90m[${timestamp}]\x1b[0m \x1b[${
      this.#colors[type]
    }${this.#logType[type].padEnd(8)}:\x1b[3m ${input}`;

    console.log(formatted);
  };

  warn = (input) => this.#print("warn", input);
  success = (input) => this.#print("success", input);
  info = (input) => this.#print("info", input);
  error = (input) => this.#print("error", input);
  debug = (input) => this.#print("debug", input);
}

module.exports = new Logger();
