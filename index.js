/* global module */
/*jslint node: true */
/*jslint indent: 2 */

"use strict";

const business = {},
    unzip = require("unzip"),
    fs = require("fs"),
    fstream = require("fstream"),
    mkdirp = require("mkdirp");

business.doTheJob = function(jsonLine, cb) {


    /**
     * décompression de l"archive
     */
    let readStream = fs.createReadStream(jsonLine.ingest.path);
    mkdirp(jsonLine.ingest.path + "/" + jsonLine.ingest.sessionName);
    let writeStream = fstream.Writer(jsonLine.ingest.path + "/" + jsonLine.ingest.sessionName);

    readStream
        .pipe(unzip.Parse())
        .pipe(writeStream);


};

business.finalJob = function(docObjects, cb) {
    var err = [];
    err.push(docObjects.pop());
    docObjects[0].ending = "finalJob";
    return cb(err);
};

module.exports = business;