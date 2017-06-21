/* global module */
/*jslint node: true */
/*jslint indent: 2 */

"use strict";

const business = {},
    unzip = require("unzip"),
    fs = require("fs"),
    fstream = require("fstream"),
    mkdirp = require("mkdirp"),
    fse = require("fs-extra");

business.doTheJob = function(jsonLine, cb) {


    /**
     * décompression de l"archive
     */
    let readStream = fs.createReadStream(jsonLine.corpusRoot + "/" + jsonLine.zipFile);
    mkdirp(jsonLine.corpusRoot + "/" + jsonLine.sessionName);
    let writeStream = fstream.Writer(jsonLine.corpusRoot + "/" + jsonLine.sessionName);

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