'use strict';

var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var File = require('gulp-util').File;
var findit = require('findit');
var assert = require('assert');
var mkdirp = require('mkdirp');
var intermediate = require('./index');

var origCWD = __dirname;
var origBase = path.join(origCWD, 'test');
var outputDir = '_site';
var testFiles = [
  new File({
    cwd: origCWD,
    base: origBase,
    path: path.join(origBase, 'top_level.js'),
    contents: new Buffer('Hey!'),
    stat: {
      atime: new Date(2013,2,1,1,10),
      mtime: new Date(2013,2,1,1,10),
      ctime: new Date(2013,2,1,1,10)
    }
  }),
  new File({
    cwd: origCWD,
    base: origBase,
    path: path.join(origBase, 'directory', 'nested.js'),
    contents: new Buffer('Ho!'),
    stat: {
      atime: new Date(2013,2,1,1,10),
      mtime: new Date(2013,2,1,1,10),
      ctime: new Date(2013,2,1,1,10)
    }
  }),
  new File({
    cwd: origCWD,
    base: origBase,
    path: path.join(origBase, 'empty.js'),
    contents: new Buffer('')
  })
];

it('copies files to the OS temp directory', function (done) {
  var testProcess = function (tempDir, cb) {
    var testPaths = _.pluck(testFiles, 'path');
    var tempPaths = [];
    var finder = findit(tempDir);

    finder.on('file', function (filePath) {
      tempPaths.push(filePath);
    });

    finder.on('end', function () {
      var relTestFilePaths = testPaths.map(function (testPath) {
        return (path.relative(origBase, testPath));
      });

      var relTempFilePaths = tempPaths.map(function (tempPath) {
        return (path.relative(tempDir, tempPath));
      });

      // Temp files have the right paths
      assert.equal(
        relTempFilePaths.sort().join(','),
        relTestFilePaths.sort().join(',')
      );

      testFiles.forEach(function (testFile) {
        var tempPath = path.join(tempDir, path.relative(testFile.base, testFile.path));

        // Temp files have the right contents
        assert.equal(
          testFile.contents.toString(),
          fs.readFileSync(tempPath).toString()
        );
      });

      cb();
    });
  };

  var stream = intermediate({output: outputDir}, testProcess);

  stream.on('end', function () {
    done();
  });

  stream.write(testFiles[0]);
  stream.write(testFiles[1]);
  stream.write(testFiles[2]);
  stream.resume();
  stream.end();
});

it('copies files to a custom OS temp directory', function (done) {
  var container = 'persistent-directory';

  var testProcess = function (tempDir, cb) {
    var testPaths = _.pluck(testFiles, 'path');
    var tempPaths = [];
    var finder = findit(tempDir);

    finder.on('file', function (filePath) {
      tempPaths.push(filePath);
    });

    finder.on('end', function () {
      tempPaths.forEach(function (tempPath) {
         assert.notEqual(tempPath.indexOf(container), -1);
      });

      cb();
    });
  };

  var stream = intermediate({output: outputDir, container: container}, testProcess);

  stream.on('end', function () {
    done();
  });

  stream.write(testFiles[0]);
  stream.write(testFiles[1]);
  stream.write(testFiles[2]);
  stream.resume();
  stream.end();
});

it('streams files from the output directory', function (done) {
  var genFiles = [
    { path: 'puhoy.js', contents: 'Generated!' },
    { path: 'time_room/prismo.js', contents: 'Re-generated!' },
    { path: 'glob_world/GOLB.js', contents: '' }
  ];

  var testProcess = function (tempDir, cb) {
    // Pretend a tool has read the input files and decided to
    // transform them into the following:
    genFiles.forEach(function (genFile) {
      mkdirp.sync(path.join(tempDir, outputDir, path.dirname(genFile.path)));
      fs.writeFileSync(path.join(tempDir, outputDir, genFile.path), genFile.contents);
    });

    cb();
  };

  var stream = intermediate({output: outputDir}, testProcess);

  stream.on('data', function (file) {
    var genFile = _.findWhere(
      genFiles,
      { path: path.relative(origBase, file.path) }
    );

    // Output files have the right data
    assert.equal(file.cwd, origCWD);
    assert.equal(file.base, origBase);
    assert.equal(file.contents, genFile.contents);

    genFiles = _.without(genFiles, genFile);
  });

  stream.on('end', function () {
    // All output files are written
    assert.equal(genFiles.length, 0);
    done();
  });

  stream.write(testFiles[0]);
  stream.write(testFiles[1]);
  stream.write(testFiles[2]);
  stream.end();
});

it('exposes vinyl files to the process callback', function (done) {
  var testProcess = function (tempDir, cb, vinyl) {
    assert.deepEqual(vinyl, testFiles);
    cb();
  };

  var stream = intermediate({output: outputDir}, testProcess);

  stream.on('end', function () {
    done();
  });

  stream.write(testFiles[0]);
  stream.write(testFiles[1]);
  stream.write(testFiles[2]);
  stream.resume();
  stream.end();
});

it('emits an error passed to the callback', function (done) {
  var errMessage = 'you\'ve gone crazy mad with power lust';

  var testProcess = function (tempDir, cb, fileProps) {
    cb(errMessage);
  };

  var stream = intermediate({output: outputDir}, testProcess);

  stream.on('end', function () {
    done();
  });

  stream.on('error', function (err) {
    assert.equal(err.message, errMessage);
  });

  stream.write(testFiles[2]);
  stream.resume();
  stream.end();
});

// TODO: Being lazy here, should probably test atime and mtime.
