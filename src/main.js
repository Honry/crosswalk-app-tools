// Copyright © 2014 Intel Corporation. All rights reserved.
// Use  of this  source  code is  governed by  an Apache v2
// license that can be found in the LICENSE-APACHE-V2 file.

var ShellJS = require("shelljs");
var AndroidProject = require("./AndroidProject");
var CommandParser = require("./CommandParser");
var Console = require("./Console");

/**
 * Main script.
 * @namespace main
 */

function workingDirectoryIsProject() {
    
    if (ShellJS.test("-f", "AndroidManifest.xml") &&
        ShellJS.test("-d", "xwalk_core_library")) {

        return true;
    }

    return false;
}

/**
 * Create skeleton project.
 * @param {String} packageId Identifier in the form of com.example.Foo
 * @param {Function} [callback] Callback returning true/false.
 * @returns {Boolean} true on success.
 * @memberOf main
 * @private
 */
function create(packageId, callback) {

    // Handle callback not passed.
    if (!callback)
        callback = function() {};

    var project;
    try {
        project = new AndroidProject();
    } catch (e) {
        Console.error("The Android SDK could not be found. " +
                      "Make sure the directory containing the 'android' " +
                      "executable is mentioned in the PATH environment variable.");
        callback(false);
        return;
    }

    project.generate(packageId, function(errormsg) {

        if (errormsg) {
            Console.error(errormsg);
            callback(false);
            return;
        } else {
            callback(true);
            return;
        }
    });
}

function build(type, callback) {

    // Handle callback not passed.
    if (!callback)
        callback = function() {};
    
    // Check we're inside a project
    if (!workingDirectoryIsProject()) {
        Console.error("This does not appear to be a Crosswalk project. " +
                      "AndroidManifest.xml and xwalk_core_library not found.");
        callback(false);
        return;
    }
}

/**
 * Display usage information.
 * @param {CommandParser} parser.
 * @memberOf main
 * @private
 */
function printHelp(parser) {

    var buf = parser.help();
    console.log(buf);
}

/**
 * Display version information.
 * @memberOf main
 * @private
 */
function printVersion() {

    var Package = require("../package.json");

    console.log(Package.version);
}

function main() {

    var parser = new CommandParser(process.argv);
    var cmd = parser.getCommand();
    if (cmd) {

        switch (cmd) {
        case "create":
            var packageId = parser.createGetPackageId();
            create(packageId);
            break;
        case "update":
            var version = parser.updateGetVersion();
            console.log("TODO implement");
            break;
        case "build":
            var type = parser.buildGetType();
            console.log("TODO implement");
            break;
        case "help":
            printHelp(parser);
            break;
        case "version":
            printVersion();
            break;
        default:
            // TODO
        }

    } else {

        printHelp(parser);
    }
}

module.exports = {

    main: main,

    test: {
        create: create,
        printHelp: printHelp,
        printVersion: printVersion
    }
};
