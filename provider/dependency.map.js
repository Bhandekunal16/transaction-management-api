const { performance } = require("node:perf_hooks");
const { MongoClient } = require("mongodb");
const {
  randomUUID,
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} = require("crypto");
const {} = require("../core/logger.functions");

module.exports = {
  express: require("express"),
  http: require("http"),
  cors: require("cors"),
  fs: require("fs"),
  path: require("path"),
  cluster: require("cluster"),
  os: require("os"),
  helmet: require("helmet"),
  rateLimit: require("express-rate-limit"),
  logByte: require("../core/logger.functions"),
  qr: require("qrcode"),
  cron: require("node-cron"),
  MongoClient,
  randomUUID,
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  performance,
};
