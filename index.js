/* global module */
/*jslint node: true */
/*jslint indent: 2 */

"use strict";


const _ = require("lodash"),
  decompress = require("decompress"),
  path = require("path"),
  fse = require("fs-extra"),
  uuid = require("uuid"),
  mkdirp = require("mkdirp"),
  ls = require("ls"),
  cp = require("child_process");

class CoIngest {

  constructor() {
    this.redisHost = process.env.REDIS_HOST || "localhost";
    this.redisPort = process.env.REDIS_PORT || 6379;
    this.pubClient = require("redis").createClient({
      "host": this.redisHost,
      "port": this.redisPort
    });
    this.redisClient = require("redis").createClient({
      "host": this.redisHost,
      "port": this.redisPort
    });
    this.CONDITOR_SESSION = process.env.ISTEX_SESSION || "TEST_1970-01-01-00-00-00";
    this.MODULEROOT = process.env.MODULEROOT || __dirname;
    this.redisKey = this.CONDITOR_SESSION + ":co-ingest";

  }

  doTheJob(docObject, next) {

    let id = 1;
    let count = 0;
    let myDocObjectFilePath = this.getWhereIWriteMyFiles(uuid.v4() + ".json", "out");
    let directoryOfMyFile = myDocObjectFilePath.substr(0, myDocObjectFilePath.lastIndexOf("/"));
    mkdirp.sync(directoryOfMyFile);
    let writableStream = fse.createWriteStream(myDocObjectFilePath);
    mkdirp.sync(docObject.corpusRoot);
    decompress(docObject.ingest.path, docObject.corpusRoot, {
      filter: file => path.extname(file.path) === ".xml"
    }).then(() => {
      let result = cp.spawnSync("find", [docObject.corpusRoot, "-type", "f", "-name", "*.xml"], {
        timeout: 2000,
        encoding: "utf8"
      });
      return _.each(result.output[1].split('\n'), (file) => {
        if (file === "") return;
        console.log("sortie d' un jsonLine : " + id);
        ++count;
        console.log("valeur de count :" + count);
        let newDocObject = _.cloneDeep(docObject);
        newDocObject.id = id;
        newDocObject.path = file;
        writableStream.write(JSON.stringify(newDocObject) + "\n");
        this.redisClient.hincrby("Module:" + this.redisKey, "outDocObject", 1);
        id++;
        if (count === 100) {
          count = 0;
          writableStream.end();
          this.redisClient.hincrby("Module:" + this.redisKey, "out", 1);
          this.pubClient.publish(this.redisKey + ":out", path.basename(myDocObjectFilePath));
          myDocObjectFilePath = this.getWhereIWriteMyFiles(uuid.v4() + ".json", "out");
          directoryOfMyFile = myDocObjectFilePath.substr(0, myDocObjectFilePath.lastIndexOf("/"));
          mkdirp.sync(directoryOfMyFile);
          writableStream = fse.createWriteStream(myDocObjectFilePath);

        }
      });
    }).then((array) => {
      console.log("debut de la fin");
      writableStream.end();
      if (count !== 0) {
        this.redisClient.hincrby("Module:" + this.redisKey, "out", 1);
        this.pubClient.publish(this.redisKey + ":out", path.basename(myDocObjectFilePath));
      }
      let error = new Error("Le premier docObject passe en erreur afin de ne pas polluer la chaine.");
      next(error, docObject);

    }).catch((err) => {
      next(err);
    });
  }

  finalJob(docObjects, cb) {
    cb();
  }


  getWhereIWriteMyFiles(file, dirOutOrErr) {
    return path.join(
      this.MODULEROOT,
      dirOutOrErr,
      this.CONDITOR_SESSION,
      file[0],
      file[1],
      file[2],
      file
    );
  }

}
module.exports = new CoIngest();