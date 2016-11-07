var express = require('express');
var router = express.Router();
var fs = require('fs');
var Promise = require('bluebird');
var glob = Promise.promisify(require('glob'));
var readFile = Promise.promisify(fs.readFile);
var _ = require('lodash');

var BreadcrumbMaker = require('../lib/js/breadcrumb_maker.js');
var Taxon = require('./models/taxon.js');

  router.get('/', function (req, res) {
    var documentTypeExamples = {};
    getMetadata().
    then(function (metadata) {
        var documentMetadata = metadata.document_metadata;

        _.each(documentMetadata, function (metadata, basePath) {
          if(!documentTypeExamples[metadata.document_type]) {
            documentTypeExamples[metadata.document_type] = basePath;
          }
        });
        documentTypeExamples = _.map(documentTypeExamples, function (basePath, documentType) {
          return {
            documentType: documentType,
            basePath: basePath
          };
        });
        documentTypeExamples = _.sortBy(documentTypeExamples, "documentType");

        res.render('index', {
         documentTypeExamples: documentTypeExamples 
       });
      });
  });

  router.get('/alpha-taxonomy/:taxon', function (req, res) {
    var taxonName = req.params.taxon;
    var url = "/alpha-taxonomy/" + taxonName;
    getMetadata().
    then(function (metadata) {
        var breadcrumbMaker = new BreadcrumbMaker(metadata);
        var taxonContent = {};

        var taxon = Taxon.fromMetadata(url, metadata);
        var breadcrumb = breadcrumbMaker.getBreadcrumbForTaxon([url]);
        taxonContent.guidance = taxon.filterByHeading('guidance');

        res.render('taxon', {
          taxon: taxon,
          parentTaxon: breadcrumb[breadcrumb.length - 1],
          breadcrumb: breadcrumb,
          taxonContent: taxonContent
        });
      });
  });

  /* The two routes below, 'static-service' and 'become-childminder' are rough
   examples of services.  Services are currenly outside of the scope of the
   prototype but may be looked at in the future.*/

  router.get('/static-service/', function (req, res) {
      res.render('service');
  });

  router.get('/become-childminder/', function (req, res) {
      res.render('become-a-childminder');
  });

  router.get('/parent-topic', function (req, res) {
    res.render('parent-topic');
  });

  router.get('/child-topic', function (req, res) {
    res.render('child-topic');
  });

  router.get('/view-all', function (req, res) {
    res.render('view-all');
  });
  
  router.get(/\/.+/, function (req, res) {
    var url = req.url;
    url = url.slice(1, url.length); // base path without leading slash
    var basename = url.replace(/\//g, '_');

    var directory = __dirname + '/content/';

    var globPage = glob(directory + "/**/" + basename + ".html");

    globPage.
    then(function (file) {
      var filePath = file[0];

      return filePath;
    }).
    then(function (filePath) {
      readFile(filePath).
      then(function (data) {
        var content = data.toString();
        var whitehall = filePath.match(/whitehall/);
        var htmlManual = filePath.match(/manual/);
        var htmlPublication = content.match(/html-publications-show/);

        if (!htmlPublication) {
          // Skip breadcrumbs and taxons for HTML publications since they have a unique format
          var getBreadcrumbPromise = getMetadata().then(function (metadata){
            var breadcrumbMaker = new BreadcrumbMaker(metadata);
            var breadcrumb = breadcrumbMaker.getBreadcrumbForContent(url);

            return breadcrumb;
          });

          var getTaxonPromise = getTaxons(url).
          then(function (taxons){
            return taxons;
          });

          Promise.all([getBreadcrumbPromise, getTaxonPromise]).
          spread(function (getBreadcrumbPromise, getTaxonPromise){
            var breadcrumb = getBreadcrumbPromise;
            var taxons = getTaxonPromise;
            res.render('content', {
              content: content,
              breadcrumb: breadcrumb,
              taxons: taxons,
              whitehall: whitehall,
              htmlManual: htmlManual
            });
          });
        }
        else {
          res.render('content', {
            content: content,
            whitehall: whitehall
          });
        }
      },
      function (err) {
        res.status(404).render('404');
      });
    });
  });

  function getMetadata () {
    return readFile('app/data/metadata_and_taxons.json').
    catch(function (err) {
        console.log('Failed to read metadata and taxons.');
    }).
    then(function (data) {
      return JSON.parse(data);
    });
  }

  function getTaxons (url) {
    return getMetadata().
    then(function (metadata) {
      return metadata.taxons_for_content[url].
      map(function (taxonBasePath) {
        return Taxon.fromMetadata(taxonBasePath, metadata);
      });
    });
  }

  module.exports = router;
