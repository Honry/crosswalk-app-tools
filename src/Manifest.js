// Copyright © 2014 Intel Corporation. All rights reserved.
// Use  of this  source  code is  governed by  an Apache v2
// license that can be found in the LICENSE-APACHE-V2 file.

var FS = require("fs");

var CommandParser = require("./CommandParser");
var IllegalAccessException = require("./util/exceptions").IllegalAccessException;

/**
 * Manifest wrapper.
 * @param {OutputIface} output Output implementation
 * @param {String} path Path to manifest.json
 */
function Manifest(output, path) {

    this._output = output;
    this._path = path;

    var buffer = FS.readFileSync(path, {"encoding": "utf8"});
    var json = JSON.parse(buffer);

    // App version is [major.][minor.]micro
    // Major and minor need to be < 100, micro < 1000
    if (json.crosswalk_app_version &&
        json.crosswalk_app_version.match("^([0-9]+\.){0,2}[0-9]+$")) {

        var valid = true;
        var numbers = json.crosswalk_app_version.split(".");
        for (var i = 0; i < numbers.length; i++) {
            if (i == numbers.length - 1 &&
                numbers[i] >= 1000) {
                // Last component, up to 3 digits
                output.warning("App version part '" + numbers[i] + "' must be < 1000");
                valid = false;
                break;
            } else if (i < numbers.length - 1 &&
                       numbers[i] >= 100) {
                // First 2 components, up to 2 digits
                output.warning("App version part '" + numbers[i] + "' must be < 100");
                valid = false;
                break;
            }
        }

        if (valid) {
            this._appVersion = json.crosswalk_app_version;
        }
    }

    if (!this._appVersion) {
        output.error("Invalid app version '" + json.crosswalk_app_version + "' in the manifest");
        // TODO maybe exception
    }

    // Name
    if (json.name &&
        typeof json.name === "string") {
        this._name = json.name;
    }

    if (!this._name) {
        output.warning("Invalid or missing field 'name' in manifest.json");
    }

    // Short name
    if (json.short_name &&
        typeof json.short_name === "string") {
        this._shortName= json.short_name;
    }

    // Display
    this._display = "standalone";
    if (json.display) {

        if (["fullscreen", "standalone"].indexOf(json.display) > -1) {
            // supported mode
            this._display = json.display;
        } else {
            output.warning("Unsupported value '" + json.display + "' in manifest.json");
        }
    }

    // Start URL
    // TODO check value
    if (json.start_url &&
        typeof json.start_url === "string") {
        this._startUrl = json.start_url;
    }

    // Package ID
    if (json.crosswalk_package_id &&
        CommandParser.validatePackageId(json.crosswalk_package_id, this._output)) {
        this._packageId = json.crosswalk_package_id;
    } else {
        throw new Error("manifest.json: Invalid package ID '" + json.crosswalk_package_id + "'");
    }

    // Target platforms
    if (json.crosswalk_target_platforms &&
        typeof json.crosswalk_target_platforms === "string") {
        this._targetPlatforms = json.crosswalk_target_platforms;
    }

    if (!this._targetPlatforms) {
        output.error("Missing or invalid target platforms in the manifest");
        output.error("Try adding");
        output.error('    "crosswalk_target_platforms": "android"');
        output.error("or similar for platform of choice.");
    }

    // Android animatable view
    this._androidAnimatableView = false;
    if (json.crosswalk_android_animatable_view) {

        // Recognise boolean or string true.
        if (typeof json.crosswalk_android_animatable_view === "boolean" ||
        json.crosswalk_android_animatable_view === "true") {
            this._androidAnimatableView = true;
        }
    }

    // Android "keep screen on"
    this._androidKeepScreenOn = false;
    if (json.crosswalk_android_keep_screen_on) {

        // Recognise boolean or string true.
        if (typeof json.crosswalk_android_keep_screen_on === "boolean" ||
        json.crosswalk_android_keep_screen_on === "true") {
            this._androidKeepScreenOn = true;
        }
    }

    // Windows update ID
    // Optional field, only check if present.
    this._windowsUpdateId = null;
    if (json.crosswalk_windows_update_id) {

        var parts = json.crosswalk_windows_update_id.split("-");
        if (parts.length === 5 &&
            parts[0].length === 8 && parts[0].match("^[0-9]*$") &&
            parts[1].length === 4 && parts[1].match("^[0-9]*$") &&
            parts[2].length === 4 && parts[2].match("^[0-9]*$") &&
            parts[3].length === 4 && parts[3].match("^[0-9]*$") &&
            parts[4].length === 12 && parts[4].match("^[0-9]*$")) {

            this._windowsUpdateId = json.crosswalk_windows_update_id;

        } else {

            output.error("Invalid Windows Update ID + '" + json.crosswalk_windows_update_id + "'");
        }
    }

    // Windows vendor field
    // Optional field, only check if present.
    this._windowsVendor = null;
    if (json.crosswalk_windows_vendor) {
        if (typeof json.crosswalk_windows_vendor === "string") {
            this._windowsVendor = json.crosswalk_windows_vendor;
        } else {
            output.error("Windows target: Invalid vendor field + '" + json.crosswalk_windows_vendor + "'");
        }
    }
}

/**
 * Create manifest at project creation stage.
 * @param {OutputIface} output Output implementation
 * @param {String} path Path to manifest.json
 * @param {String} packageId Unique package identifier com.example.foo
 * @returns {Manifest} Loaded manifest instance.
 * @memberOf Manifest
 * @static
 */
Manifest.create =
function(path, packageId) {

    // Emulate old behaviour of using default backend,
    // Just put it into the manifest now, upon creation.
    var PlatformsManager = require("./PlatformsManager");
    var mgr = new PlatformsManager(require("./TerminalOutput").getInstance());
    var platformInfo = mgr.loadDefault();

    // Create windows update id
    // Format is: 12345678-1234-1234-1234-111111111111
    // So we create 32+ random digits, then insert dashes.
    var digits = "";
    while (digits.length <= 32) {
        // Cut off leading "0."
        var randoms = Math.random().toString().substring(2);
        digits += randoms;
    }
    var windowsUpdateId = digits.substring(0, 8) + "-" +
                          digits.substring(8, 12) + "-" +
                          digits.substring(12, 16) + "-" +
                          digits.substring(16, 20) + "-" +
                          digits.substring(20, 32);

    var buffer = JSON.stringify({
        // Standard fields
        "name": packageId,
        "short_name": packageId.split(".").pop(),
        "display": "standalone",
        "start_url": "index.html",
        // Crosswalk fields
        "crosswalk_app_version": "1",
        "crosswalk_package_id": packageId,
        "crosswalk_target_platforms": platformInfo.platformId,
        // Android fields
        "crosswalk_android_animatable_view": false,
        "crosswalk_android_keep_screen_on": false,
        // Windows fields
        "crosswalk_windows_update_id": windowsUpdateId,
        "crosswalk_windows_vendor": "(Vendor)"  // optional, placeholder
    });
    FS.writeFileSync(path, buffer);
};

/**
 * Update fields in Manifest.json
 * @param {Object} data Data object
 * @returns {Boolean} True on success, false on failure
 * @private
 */
Manifest.prototype.update =
function(data) {

    var buffer = FS.readFileSync(this._path, {"encoding": "utf8"});
    if (!buffer) {
        this._output.error("Failed to read '" + this._path + "'");
        return false;
    }

    var json = JSON.parse(buffer);
    if (!json) {
        this._output.error("Failed to parse '" + this._path + "'");
        return false;
    }

    // Update JSON
    for (var prop in data) {
        json[prop] = data[prop];
    }

    // Write back
    buffer = JSON.stringify(json);
    FS.writeFileSync(this._path, buffer);

    return true;
};

/**
 * Application version a.b.c where a,b < 100, c < 1000
 * @member {String} version
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "appVersion", {
                      get: function() {
                                return this._appVersion;
                           }
                      });

/**
 * Application name
 * @member {String} name
 * @throws {IllegalAccessException} If name is not a string.
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "name", {
                      get: function() {
                                return this._name;
                           },
                      set: function(name) {
                                if (typeof name === "string") {
                                    this._name = name;
                                    this.update({"name": this._name});
                                } else {
                                    var errormsg = "Invalid app name '" + name + "'";
                                    this._output.error(errormsg);
                                    throw new IllegalAccessException(errormsg);
                                }
                           }
                      });

/**
 * Application short name.
 * @member {String} shortName
 * @throws {IllegalAccessException} If name is not a string.
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "shortName", {
                      get: function() {
                                return this._shortName;
                           },
                      set: function(shortName) {
                                if (typeof shortName === "string") {
                                    this._shortName = shortName;
                                    this.update({"short_name": this._shortName});
                                } else {
                                    var errormsg = "Invalid app short name '" + shortName + "'";
                                    this._output.error(errormsg);
                                    throw new IllegalAccessException(errormsg);
                                }
                           }
                      });

/**
 * Display
 * @member {String} display
 * @instance
 * @memberOf Manifest
 * @see http://www.w3.org/TR/appmanifest/#display-member
 */
Object.defineProperty(Manifest.prototype, "display", {
                      get: function() {
                                return this._display;
                           }
                      });

/**
 * Start URL
 * @member {String} startUrl
 * @instance
 * @memberOf Manifest
 * @see http://www.w3.org/TR/appmanifest/#start_url-member
 */
Object.defineProperty(Manifest.prototype, "startUrl", {
                      get: function() {
                                return this._startUrl;
                           }
                      });

/**
 * Package ID
 * @member {String} packageId
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "packageId", {
                      get: function() {
                                return this._packageId;
                           }
                      });

/**
 * Animatable view on android.
 * @member {String} androidAnimatableView
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "androidAnimatableView", {
                      get: function() {
                                return this._androidAnimatableView;
                           }
                      });

/**
 * "Keep screen on" on android.
 * @member {String} androidKeepScreenOn
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "androidKeepScreenOn", {
                      get: function() {
                                return this._androidKeepScreenOn;
                           }
                      });

/**
 * Build target platforms for the apps
 * @member {String} targetPlatforms
 * @throws {IllegalAccessException} If unknown target platforms are set.
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "targetPlatforms", {
                      get: function() {
                                return this._targetPlatforms;
                           },
                      set: function(targetPlatforms) {
                                var PlatformsManager = require("./PlatformsManager");
                                var mgr = new PlatformsManager(this._output);
                                if (typeof targetPlatforms === "string" &&
                                    mgr.load(targetPlatforms)) {
                                    this._targetPlatforms = targetPlatforms;
                                    this.update({"crosswalk_target_platforms": this._targetPlatforms});
                                } else {
                                    var errormsg = "Target platform '" + targetPlatforms + "' not available";
                                    this._output.error(errormsg);
                                    throw new IllegalAccessException(errormsg);
                                }
                           }
                      });

/**
 * Windows update ID
 * @member {String} windowsUpdateId
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "windowsUpdateId", {
                      get: function() {
                                return this._windowsUpdateId;
                           }
                      });

/**
 * Vendor field for Windows
 * @member {String} windowsVendor
 * @instance
 * @memberOf Manifest
 */
Object.defineProperty(Manifest.prototype, "windowsVendor", {
                      get: function() {
                                return this._windowsVendor;
                           }
                      });

module.exports = Manifest;
