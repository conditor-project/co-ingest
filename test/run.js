/* global __dirname, require, process, it */

'use strict';

var
  fs = require('fs-extra')
  , path = require('path')
  , pkg = require('../package.json')
  , business = require('../index.js')
  , chai = require('chai')
  , expect = chai.expect
  ;


let jsonInput = {
    ingest: {
      type: 'zip',
      path: path.join(__dirname, 'dataset/zip/input.zip')
    },
    corpusRoot: path.join(__dirname, 'dataset/zip/out')
  };

describe(pkg.name + '/index.js', function () {

  // Méthde finale sensée faire du nettoyage après les tests
  before(function (done) {

    // Nettoyage du corpusRoot;
    fs.mkdirsSync(jsonInput.corpusRoot);

    done();

  });

  describe('#doTheJob pour les ingestions de type "zip"', function () {

    it('devrait extraire les notices et générer les docObjects correspondant @1', function (done) {
      var docObject;
      business.doTheJob(jsonInput, function (err) {

        expect(err, "La fonction doTheJob ne devrait pas renvoyer d'erreur").to.be.undefined;

        // vérifie que tous les fichiers du zip ont bien été dézippés
        const unzippedFiles = [
          path.join(jsonInput.corpusRoot,'notice1.xml'),
          path.join(jsonInput.corpusRoot,'notice2.xml'),
          path.join(jsonInput.corpusRoot,'1/notice1-1.xml'),
          path.join(jsonInput.corpusRoot,'2/notice2-1.xml'),
          path.join(jsonInput.corpusRoot,'2/1/notice2-1-1.xml'),
          path.join(jsonInput.corpusRoot,'2/1/notice2-1-2.xml'),
          path.join(jsonInput.corpusRoot,'2/1/notice2-1-3.xml'),
          path.join(jsonInput.corpusRoot,'2/2/notice2-2-1.xml'),
          path.join(jsonInput.corpusRoot,'2/2/notice2-2-2.txt'),
          path.join(jsonInput.corpusRoot,'2/2/notice2-2-3.xml')
        ];
        for (let f of unzippedFiles) {
          expect(fs.existsSync(f),`Le fichier ${f} devrait exister`).to.be.true;
        }
        done();
      });
    });

  });

  // Méthde finale sensée faire du nettoyage après les tests
  after(function (done) {

    // Nettoyage du corpusRoot;
    fs.removeSync(jsonInput.corpusRoot);

    done();

  });


});
