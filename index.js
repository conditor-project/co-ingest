'use strict';

const _ = require('lodash');
const decompress = require('decompress');
const path = require('path');
const fse = require('fs-extra');
const uuid = require('uuid');
const cp = require('child_process');
const async = require('async');
const Promise = require('bluebird');
const Redis = require('ioredis');

class CoIngest {
  constructor () {
    this.redisHost = process.env.REDIS_HOST || 'localhost';
    this.redisPort = process.env.REDIS_PORT || 6379;
    this.pubClient = new Redis({
      'host': this.redisHost,
      'port': this.redisPort
    });
    this.redisClient = new Redis({
      'host': this.redisHost,
      'port': this.redisPort
    });
    this.CONDITOR_SESSION = process.env.ISTEX_SESSION || 'TEST_1970-01-01-00-00-00';
    this.MODULEROOT = process.env.MODULEROOT || __dirname;
    this.redisKey = this.CONDITOR_SESSION + ':co-ingest';
    this.id = 0;
    this.endFlag = false;
    this.sendFlag = false;
  }

  disconnect () {
    Promise.try(() => {
      return this.pubClient.disconnect();
    }).then(() => {
      return Promise.try(() => {
        return this.redisClient.disconnect();
      });
    }).catch(() => {
      throw (new Error('Erreur de fermeture ioredis.'));
    });
  }

  pushDocObject (docObject, blocContainer) {
    return Promise.try(() => {
      let arrayPathFile = [];
      let blocContain = {};
      _.each(blocContainer.bloc, (pathFile) => {
        let newDocObject;
        newDocObject = _.cloneDeep(docObject);
        newDocObject.id = this.id;
        newDocObject.path = pathFile;
        newDocObject.originDocPath = pathFile;
        newDocObject.source = docObject.source;
        newDocObject.sessionName = this.CONDITOR_SESSION;
        this.id++;
        arrayPathFile.push(newDocObject);
      });
      blocContain.bloc = arrayPathFile;
      this.blocFormate.push(blocContain);
    });
  }

  streamInit (docObject, next) {
    return Promise.try(() => {
      let bloc,
        streamXML;
      let listing = [];
      let listPath = '';

      streamXML = cp.spawn('find', [docObject.corpusRoot, '-type', 'f', '-name', '*.xml'], {
        timeout: 2000,
        encoding: 'utf8'
      });

      streamXML.stdout.on('data', (chunk) => {
        let blocContainer = {};
        listPath += chunk.toString();
        _.each(listPath.substring(0, listPath.lastIndexOf('\n')).split('\n'), (pathXML) => {
          if (pathXML.trim() !== '') { listing.push(pathXML.trim()); }
        });
        listPath = listPath.substring(listPath.lastIndexOf('\n'), listPath.length);
        while (listing.length > 100) {
          bloc = listing.splice(0, 100);
          _.shuffle(bloc);
          blocContainer.bloc = bloc;
          this.pushDocObject(docObject, blocContainer);
        }
      });

      streamXML.stderr.on('data', (chunk) => {
        let err = new Error('Erreur stderr streamXML(co-ingest): ' + chunk);
        next(err);
      });

      streamXML.stdout.on('end', (chunk) => {
        let blocContainer = {};
        this.endFlag = true;
        if (chunk) { listPath += chunk.toString(); }
        if (listPath.trim() !== '') {
          _.each(listPath.split('\n'), (pathXML) => {
            if (pathXML.trim() !== '') { listing.push(pathXML.trim()); }
          });
        }
        while (listing.length > 100) {
          bloc = listing.splice(0, 100);
          _.shuffle(bloc);
          blocContainer.bloc = bloc;
          this.pushDocObject(docObject, blocContainer);
        }
        if (listing.length > 0) {
          bloc = listing.splice(0, listing.length);
          _.shuffle(bloc);
          blocContainer.bloc = bloc;
          this.pushDocObject(docObject, blocContainer);
        }
      });
    });
  }

  doTheJob (docObject, next) {
    fse.ensureDir(docObject.corpusRoot, function (error) {
      if (error) {
        let err = new Error('Erreur de création d\'arborescence : ' + error);
        next(err);
      }
    });

    this.blocFormate = async.queue(this.sendFlux.bind(this), 8);

    this.blocFormate.drain = () => {
      if (this.endFlag) {
        let error = new Error('Le premier docObject passe en erreur afin de ne pas polluer la chaine.');
        docObject.error = 'Le premier docObject passe en erreur afin de ne pas polluer la chaine.';
        next(error, docObject);
      }
    };

    decompress(docObject.ingest.path, docObject.corpusRoot, {
      filter: file => path.extname(file.path) === '.xml'
    }).catch(function (error) {
      let err = new Error('Erreur de décompression du zip : ' + error);
      next(err);
    }).then(this.streamInit.bind(this, docObject, next))
      .catch(function (error) {
        let err = new Error('Erreur de génération du flux : ' + error);
        next(err);
      });
  }

  sendFlux (blocContainer, callback) {
    return Promise.try(() => {
      let fileName = uuid.v4() + '.json';
      let myDocObjectFilePath = this.getWhereIWriteMyFiles(fileName, 'out');
      let directoryOfMyFile = myDocObjectFilePath.substr(0, myDocObjectFilePath.lastIndexOf('/'));

      return fse.ensureDir(directoryOfMyFile).then(() => {
        return Promise.try(() => {
          let constructedString = '';
          _.each(blocContainer.bloc, (docObject) => {
            constructedString += JSON.stringify(docObject) + '\n';
          });
          if (constructedString !== '') {
            try {
              fse.writeFileSync(myDocObjectFilePath, constructedString);
            } catch (err) {
              callback(new Error('Erreur de flux d\'ecriture : ' + err));
            }
            this.sendFlag = true;
          } else {
            this.sendFlag = false;
          }
          return true;
        });
      }).then(this.sendRedis.bind(this, myDocObjectFilePath, blocContainer, callback)).catch(err => {
        console.error(err);
      });
    });
  }

  sendRedis (myDocObjectFilePath, blocContainer, callback) {
    return Promise.try(() => {
      if (this.sendFlag === true) {
        let pipelineClient = this.redisClient.pipeline();
        let pipelinePublish = this.pubClient.pipeline();
        pipelineClient.hincrby('Module:' + this.redisKey, 'outDocObject', blocContainer.bloc.length)
          .hincrby('Module:' + this.redisKey, 'out', 1).exec();
        pipelinePublish.publish(this.redisKey + ':out', path.basename(myDocObjectFilePath)).exec();
        callback();
      } else {
        callback();
      }
    });
  }

  finalJob (docObjects, done) {
    Promise.try(() => {
      return this.disconnect();
    }).then(() => {
      done();
    }).catch(err => {
      done(err);
    });
  }

  getWhereIWriteMyFiles (file, dirOutOrErr) {
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
