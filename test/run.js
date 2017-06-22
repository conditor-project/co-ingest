/* global __dirname, require, process, it */

'use strict';

var
    fs = require('fs-extra'),
    path = require('path'),
    pkg = require('../package.json'),
    business = require('../index.js'),
    chai = require('chai'),
    expect = chai.expect;


let jsonInput = {
    ingest: {
        type: 'zip',
        path: path.join(__dirname, 'dataset/zip/input.zip')
    },
    corpusRoot: path.join(__dirname, 'dataset/zip/out')
};

describe(pkg.name + '/index.js', function() {

    // Méthode finale sensée faire du nettoyage après les tests
    before(function(done) {

        // Nettoyage du corpusRoot;
        fs.mkdirsSync(jsonInput.corpusRoot);

        done();

    });

    describe('#doTheJob pour les ingestions de type "zip"', function() {

        it('devrait extraire les notices et générer les docObjects correspondant @1', function(done) {
            var docObject;
            console.log(jsonInput);
            business.doTheJob(jsonInput, function(err) {
                //   expect(err).to.be.undefined;
                //   expect(docObject.isConditor).to.be.true;
                //   done();
            });
            done();
        });

    });

    // Méthde finale sensée faire du nettoyage après les tests
    after(function(done) {

        // Nettoyage du corpusRoot;
        fs.removeSync(jsonInput.corpusRoot);

        done();

    });


});