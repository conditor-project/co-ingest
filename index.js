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
   let streamXML;
   let listing=[];
   let bloc;
   let blocFormate=[];
   let newDocObject;
   let listPath="";
    
// On crée le répertoire utile
    mkdirp.sync(docObject.corpusRoot);

// On décompresse l'archive 
    decompress(docObject.ingest.path, docObject.corpusRoot, {
      filter: file => path.extname(file.path) === ".xml"
    }).then(() => {

      let id=0;
      streamXML = cp.spawn("find", [docObject.corpusRoot, "-type", "f", "-name", "*.xml"], {
        timeout: 2000,
        encoding: "utf8"
      });

      streamXML.stdout.on("data",(chunk)=>{
        listPath+=chunk.toString();

        _.each(listPath.substring(0,listPath.lastIndexOf("\n")).split("\n"),(pathXML)=>{
          if (pathXML.trim()!=="") listing.push(pathXML.trim());
        });
        listPath = listPath.substring(listPath.lastIndexOf("\n"),listPath.length);
        while (listing.length>100){
          bloc=listing.splice(0,100);
          _.shuffle(bloc);
          blocFormate=[];
          _.each(bloc,(pathFile)=>{
            newDocObject = _.cloneDeep(docObject);
            newDocObject.id = id;
            newDocObject.path = pathFile;
            newDocObject.source = docObject.source;
            newDocObject.ingestId = this.CONDITOR_SESSION;
            id++;
            blocFormate.push(newDocObject)
          });
          this.sendFlux(blocFormate,docObject,next);
        }
      });

      streamXML.stdout.on("end",(chunk)=>{
        if (listPath.trim()!==""){
          _.each(listPath.split("\n"),(pathXML)=>{
            if (pathXML.trim()!=="") listing.push(pathXML.trim());
          });
        }
        if (listing.length>0){
          bloc=listing.splice(0,(listing.length));
          _.shuffle(bloc);
          blocFormate=[];
          _.each(bloc,(pathFile)=>{
            newDocObject = _.cloneDeep(docObject);
            newDocObject.id = id;
            newDocObject.path = pathFile;
            newDocObject.source = docObject.source;
            newDocObject.ingestId = this.CONDITOR_SESSION;
            id++;
            blocFormate.push(newDocObject);
          });
          this.sendFlux(blocFormate,docObject,next,true);
        }
      });

    });
  }

  

  sendFlux(bloc,docObject,next,endFlag=false){
    if (bloc.length>0){
      let nomFichier = uuid.v4()+".json";
      let myDocObjectFilePath = this.getWhereIWriteMyFiles(nomFichier, "out");
      let directoryOfMyFile = myDocObjectFilePath.substr(0, myDocObjectFilePath.lastIndexOf("/"));
      mkdirp.sync(directoryOfMyFile);
      let writableStream = fse.createWriteStream(myDocObjectFilePath);
      mkdirp.sync(docObject.corpusRoot);
      _.each(bloc,(object)=>{
        object.ingestBaseName=nomFichier; 
        writableStream.write(JSON.stringify(object) + "\n");
      });
      writableStream.end(this.sendRedis.bind(this,myDocObjectFilePath,bloc.length,docObject,next,endFlag));
    }
  }

  sendRedis(myDocObjectFilePath,length,docObject,next,endFlag=false){
    //console.log("envoi des infos à redis key:"+this.redisKey+" path:"+path.basename(myDocObjectFilePath));
    let pipelineClient = this.redisClient.pipeline();
    let pipelinePublish = this.pubClient.pipeline();
    pipelineClient.hincrby("Module:"+this.redisKey,"outDocObject",length)
    .hincrby("Module:"+this.redisKey,"out",1).exec();
    pipelinePublish.publish(this.redisKey + ":out",path.basename(myDocObjectFilePath)).exec();
    this.sendEndFlag(next,docObject,endFlag);
  }
  

  sendEndFlag(next,docObject,endFlag){
    if (endFlag){
      console.log("fin");
      let error = {
        errCode: 1,
        errMessage: "Le premier docObject passe en erreur afin de ne pas polluer la chaine."
      };
      docObject.error = error;
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