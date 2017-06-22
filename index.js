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
    promise = require("bluebird"),
    ls = require("ls");

class CoIngest {

    constructor() {
        this.redisHost = process.env.REDIS_HOST || "localhost";
        this.redisPort = process.env.REDIS_URL || 6379;
        this.pubClient = require("redis").createClient({
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

        decompress(docObject.ingest.path, docObject.corpusRoot + "/" + docObject.ingest.sessionName, {
            filter: file => path.extname(file.path) === ".xml"
        }).then(() => {
            let all_files = ls(docObject.corpusRoot + "/" + docObject.ingest.sessionName + "/*");
            return _.each(all_files, (file) => {
                console.log("sortie d' un jsonLine : " + id);
                ++count;
                console.log("valeur de count :" + count);
                const object = { id: id, path: file.full };
                writableStream.write(JSON.stringify(object) + "\n");
                this.pubClient.hincrby("Module:" + this.redisKey, "outDocObject", 1);
                id++;
                if (count === 100) {
                    count = 0;
                    writableStream.end();
                    this.pubClient.hincrby("Module:" + this.redisKey, "out", 1);
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
                this.pubClient.hincrby("Module:" + this.redisKey, "out", 1);
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