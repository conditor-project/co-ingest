/* eslint-env mocha */
'use strict';

const fs = require('fs-extra');
const path = require('path');
const pkg = require('../package.json');
const business = require('../index.js');
const chai = require('chai');
const glob = require('glob');
const expect = chai.expect;

const sessionName = 'TEST_1970-01-01-00-00-00';

let jsonInput = {
  source: 'sourceName',
  ingest: {
    type: 'zip',
    path: path.join(__dirname, 'dataset/zip/in/input.zip'),
    sessionName: sessionName
  },
  corpusRoot: path.join(__dirname, 'dataset/zip/out')
};

const outDir = path.join(__dirname, '/..', 'out', sessionName);
const logDir = path.join(__dirname, 'log', sessionName);

describe(pkg.name + '/index.js', function () {
  // Méthode finale sensée faire du nettoyage après les tests
  before(function (done) {
    // initialisation des différents répertoires
    fs.mkdirsSync(jsonInput.corpusRoot);
    fs.mkdirsSync(outDir);
    fs.mkdirsSync(logDir);
    done();
  });

  describe('#doTheJob pour les ingestions de type "zip"', function () {
    it('devrait extraire les notices @1', function (done) {
      business.doTheJob(jsonInput, function (err) {
        if (err.message !== 'Le premier docObject passe en erreur afin de ne pas polluer la chaine.') return done(err);

        // vérifie que tous les fichiers du zip ont bien été dézippés
        const unzippedFiles = [
          path.join(jsonInput.corpusRoot, 'notice1.xml'),
          path.join(jsonInput.corpusRoot, 'notice2.xml'),
          path.join(jsonInput.corpusRoot, '1/notice1-1.xml'),
          path.join(jsonInput.corpusRoot, '2/notice2-1.xml'),
          path.join(jsonInput.corpusRoot, '2/1/notice2-1-1.xml'),
          path.join(jsonInput.corpusRoot, '2/1/notice2-1-2.xml'),
          path.join(jsonInput.corpusRoot, '2/1/notice2-1-3.xml'),
          path.join(jsonInput.corpusRoot, '2/2/notice2-2-1.xml'),
          path.join(jsonInput.corpusRoot, '2/2/notice2-2-3.xml')
        ];

        for (let f of unzippedFiles) {
          expect(fs.existsSync(f), `Le fichier ${f} devrait exister`).to.be.true;
        }

        done();
      });
    });

    it('devrait générer les docObjects correspondant aux notices @2', function (done) {
      const nbExpectedDocs = 9;

      // vérifie qu'en out, les fichiers JSON contenant les docObjects ont bien été générés
      glob(outDir + '/**/*.json', function (err, files) {
        if (err) return done(err);
        expect(files.length, 'les ' + nbExpectedDocs + ' documents du jeu de test sont dans un seul fichier, non pas ' + files.length).to.equal(1);

        // parcours des fichiers trouvés (fichiers pouvant contenir 100 docs
        let nbDocsFound = 0;
        let jsonObjects;
        let jsonObject;
        files.forEach(function (file) {
          jsonObjects = (fs.readFileSync(file, {
            encoding: 'utf8'
          }).trim()).split('\n');
          nbDocsFound += jsonObjects.length;

          // parcours des jsonObjects du fichier courant
          for (let i = 0; i < jsonObjects.length; i++) {
            jsonObject = JSON.parse(jsonObjects[i]);
            expect(jsonObject.source).to.be.equal('sourceName');
            expect(('' + jsonObject.id).length, 'le champ id est une chaîne caractères non vide').to.be.gt(0);
            expect(jsonObject.path.length, 'le champ path est une chaîne caractères non vide').to.be.gt(0);
            expect(fs.existsSync(jsonObject.path), `Le fichier ${jsonObject.path} devrait exister`).to.be.true;
          }
        });

        expect(nbDocsFound, 'le jeu de test ' + sessionName + ' devrait contenir ' + nbExpectedDocs + ' documents, et non pas ' + nbDocsFound).to.equal(nbExpectedDocs);

        done();
      });
    });
  });

  // Méthde finale sensée faire du nettoyage après les tests
  after(function (done) {
    // Nettoyage du corpusRoot;
    fs.removeSync(jsonInput.corpusRoot);
    fs.removeSync(outDir);
    fs.removeSync(logDir);
    business.finalJob(null, done);
  });
});
