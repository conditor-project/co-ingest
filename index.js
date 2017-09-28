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
  cp = require("child_process"),
  Redis = require("ioredis");


class CoIngest {

  constructor() {
    this.redisHost = process.env.REDIS_HOST || "localhost";
    this.redisPort = process.env.REDIS_PORT || 6379;
    this.pubClient = new Redis({
      "host": this.redisHost,
      "port": this.redisPort
    });
    this.redisClient = new Redis({
      "host": this.redisHost,
      "port": this.redisPort
    });
    this.CONDITOR_SESSION = process.env.ISTEX_SESSION || "TEST_1970-01-01-00-00-00";
    this.MODULEROOT = process.env.MODULEROOT || __dirname;
    this.redisKey = this.CONDITOR_SESSION + ":co-ingest";

  }

  doTheJob(docObject, next) {

//On initie les variables utiles

    let id = 1;
    let bloc=[];
    
// On crée le répertoire utile
    mkdirp.sync(docObject.corpusRoot);

// On décompresse l'archive 
    decompress(docObject.ingest.path, docObject.corpusRoot, {
      filter: file => path.extname(file.path) === ".xml"
    }).then(() => {
      return cp.spawnSync("find", [docObject.corpusRoot, "-type", "f", "-name", "*.xml"], {
        timeout: 2000,
        encoding: "utf8"
      }).output[1].trim().split("\n");
    }).then((listing)=>{
      let newDocObject;
      let blocFormate;
      while(listing.length>0){
        if (listing.length>100){
          bloc=listing.splice(0,100);
          blocFormate=[];
          _.each(bloc,(pathFile)=>{
            newDocObject = _.cloneDeep(docObject);
            newDocObject.id = id;
            newDocObject.path = pathFile;
            newDocObject.source = docObject.source;
            id++;
            blocFormate.push(newDocObject)
          });
          this.sendFlux(blocFormate,docObject,next);
        }
        else {
          bloc=listing.splice(0,(listing.length));
          blocFormate=[];
          _.each(bloc,(pathFile)=>{
            newDocObject = _.cloneDeep(docObject);
            newDocObject.id = id;
            newDocObject.path = pathFile;
            id++;
            blocFormate.push(newDocObject)
          });
          this.sendFlux(blocFormate,docObject,next,true);
        }
      }
    });
  }

  sendFlux(bloc,docObject,next,endFlag=false){
    if (bloc.length>0){
      let myDocObjectFilePath = this.getWhereIWriteMyFiles(uuid.v4() + ".json", "out");
      let directoryOfMyFile = myDocObjectFilePath.substr(0, myDocObjectFilePath.lastIndexOf("/"));
      mkdirp.sync(directoryOfMyFile);
      let writableStream = fse.createWriteStream(myDocObjectFilePath);
      mkdirp.sync(docObject.corpusRoot);
      _.each(bloc,(object)=>{
        writableStream.write(JSON.stringify(object) + "\n");
      });
      writableStream.end(this.sendRedis.bind(this,myDocObjectFilePath,bloc.length,docObject,next,endFlag));
    }
  }

  sendRedis(myDocObjectFilePath,length,docObject,next,endFlag=false){
    console.log("envoi des infos à redis key:"+this.redisKey+" path:"+path.basename(myDocObjectFilePath));
    let pipelineClient = this.redisClient.pipeline();
    let pipelinePublish = this.pubClient.pipeline();
    pipelineClient.hincrby("Module:"+this.redisKey,"outDocObject",length)
    .hincrby("Module:"+this.redisKey,"out",1).exec();
    pipelinePublish.publish(this.redisKey + ":out",path.basename(myDocObjectFilePath)).exec();
    this.sendEndFlag(next,docObject,endFlag);
    /** 
    this.redisClient.hincrby("Module:" + this.redisKey, "outDocObject", length)
    .then(this.redisClient.hincrby("Module:"+this.redisKey,"out",1))
    .then(this.pubClient.publish(this.redisKey + ":out", path.basename(myDocObjectFilePath)))
    .then(this.sendEndFlag(next,docObject,endFlag));
    */
  }
  

  sendEndFlag(next,docObject,endFlag){
    //console.log(""+this.redisClient.get("outDocObject"));
    //console.log(""+this.redisClient.get("out"));
    if (endFlag){
      console.log("fin");
      let error = new Error("Le premier docObject passe en erreur afin de ne pas polluer la chaine.");
      next(error, docObject);
    }
  }

  finalJob(docObjects, cb){
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