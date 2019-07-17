/* eslint-disable no-console */
const xcode = require('xcode');
const fs = require('fs');
const path = require('path');
const plist = require('plist');

module.exports = function (context) {
  // if (process.argv.length >= 5 && process.argv[1].indexOf('cordova') == -1) {
  //   if (process.argv[4] != 'ios') {
  //     return; // plugin only meant to work for ios platform.
  //   }
  // }

  const xcodeProjPath = fromDir('platforms/ios', '.xcodeproj', false);
  const projectPath = xcodeProjPath + '/project.pbxproj';
  if (!fs.existsSync(projectPath)) {
    console.log('[cordova-plugin-braintree] XCode project not found under platforms/ios, skipping install hook');
    return;
  }
  const myProj = xcode.project(projectPath);
  myProj.parseSync();

  // unquote (remove trailing ")
  var projectName = myProj.getFirstTarget().firstTarget.name;
  if (projectName.charAt(0) == '"') {
    projectName = projectName.substr(1);
    projectName = projectName.substr(0, projectName.length - 1); // Removing the char " at beginning and the end.
  }

  // cordova@7 embeds the frameworks so this script is only required for cordova < 7
  if (parseInt(context.opts.cordova.version) < 7) {
    addRunpathSearchBuildProperty(myProj, 'Debug');
    addRunpathSearchBuildProperty(myProj, 'Release');

    const groupName = 'Embed Frameworks ' + context.opts.plugin.id;
    const pluginPathInPlatformIosDir = projectName + '/Plugins/' + context.opts.plugin.id;

    process.chdir('./platforms/ios');
    const frameworkFilesToEmbed = fromDir(pluginPathInPlatformIosDir, '.framework', false, true);
    process.chdir('../../');

    if (frameworkFilesToEmbed.length) {

      if (!myProj.hash.project.objects['PBXCopyFilesBuildPhase']) {
        myProj.addBuildPhase(frameworkFilesToEmbed, 'PBXCopyFilesBuildPhase', groupName, myProj.getFirstTarget().uuid, 'frameworks');
      }

      for (var frmFileFullPath of frameworkFilesToEmbed) {
        var justFrameworkFile = path.basename(frmFileFullPath);
        var fileRef = getFileRefFromName(myProj, justFrameworkFile);
        var fileId = getFileIdAndRemoveFromFrameworks(myProj, justFrameworkFile);

        // Adding PBXBuildFile for embedded frameworks
        var file = {
          uuid: fileId,
          basename: justFrameworkFile,
          settings: {
            ATTRIBUTES: ['CodeSignOnCopy', 'RemoveHeadersOnCopy'],
          },
          fileRef: fileRef,
          group: groupName,
        };

        myProj.addToPbxBuildFileSection(file);

        // Adding to Frameworks as well (separate PBXBuildFile)
        var newFrameworkFileEntry = {
          uuid: myProj.generateUuid(),
          basename: justFrameworkFile,
          fileRef: fileRef,
          group: 'Frameworks',
        };

        myProj.addToPbxBuildFileSection(newFrameworkFileEntry);
        myProj.addToPbxFrameworksBuildPhase(newFrameworkFileEntry);
      }

      console.log('[cordova-plugin-braintree] Embedded Frameworks in ' + context.opts.plugin.id);
    }
  }

  if (hasShellScript(myProj)) {
    console.log('[cordova-plugin-braintree] Architecture stripping script already included in project, skipping step');
  } else {
    // The script embedded here comes from
    // http://ikennd.ac/blog/2015/02/stripping-unwanted-architectures-from-dynamic-libraries-in-xcode/
    // with modifications suggested by
    // https://stackoverflow.com/questions/30547283/submit-to-app-store-issues-unsupported-architecture-x86
    // eslint-disable-next-line max-len
    var buildPhase = myProj.addBuildPhase([], 'PBXShellScriptBuildPhase', '[cordova-plugin-braintree]: Run Script -- Strip architectures', myProj.getFirstTarget().uuid, { inputPaths: '', outputPaths: '', shellPath: '', shellScript: '' }).buildPhase;
    buildPhase['shellPath'] = '/bin/sh';
    // eslint-disable-next-line max-len
    buildPhase['shellScript'] = '"APP_PATH=\\"${TARGET_BUILD_DIR}/${WRAPPER_NAME}\\"\\n\\n# This script loops through the frameworks embedded in the \\n# application and removes unused architectures.\\nfind \\"$APP_PATH\\" -name \'*.framework\' -type d | while read -r FRAMEWORK\\ndo\\n    FRAMEWORK_EXECUTABLE_NAME=$(defaults read \\"$FRAMEWORK/Info.plist\\" CFBundleExecutable)\\n    FRAMEWORK_EXECUTABLE_PATH=\\"$FRAMEWORK/$FRAMEWORK_EXECUTABLE_NAME\\"\\n    echo \\"Executable is $FRAMEWORK_EXECUTABLE_PATH\\"\\n    echo $(lipo -info \\"$FRAMEWORK_EXECUTABLE_PATH\\")\\n\\n    case \\"${TARGET_BUILD_DIR}\\" in *\\"iphonesimulator\\") echo \\"Skip simulator target\\"; continue ;; esac\\n\\n    EXTRACTED_ARCHS=()\\n\\n    for ARCH in $ARCHS\\n    do\\n        echo \\"Extracting $ARCH from $FRAMEWORK_EXECUTABLE_NAME\\"\\n        lipo -extract \\"$ARCH\\" \\"$FRAMEWORK_EXECUTABLE_PATH\\" -o \\"$FRAMEWORK_EXECUTABLE_PATH-$ARCH\\"\\n        EXTRACTED_ARCHS+=(\\"$FRAMEWORK_EXECUTABLE_PATH-$ARCH\\")\\n    done\\n\\n    echo \\"Merging extracted architectures: ${ARCHS}\\"\\n    lipo -o \\"$FRAMEWORK_EXECUTABLE_PATH-merged\\" -create \\"${EXTRACTED_ARCHS[@]}\\"\\n    rm \\"${EXTRACTED_ARCHS[@]}\\"\\n\\n    echo \\"Replacing original executable with thinned version\\"\\n    rm \\"$FRAMEWORK_EXECUTABLE_PATH\\"\\n    mv \\"$FRAMEWORK_EXECUTABLE_PATH-merged\\" \\"$FRAMEWORK_EXECUTABLE_PATH\\"\\ndone\\n"';
    buildPhase['runOnlyForDeploymentPostprocessing'] = 0;

    console.log('[cordova-plugin-braintree] Added Arch stripping run script build phase');
  }

  fs.writeFileSync(projectPath, myProj.writeSync());
  // fs.writeFileSync(projectPath, myProj.writeSync());

  /* add ${PRODUCT_BUNDLE_IDENTIFIER}.payments to URL Schemes */
  process.chdir('./platforms/ios/' + projectName);
  var infoPlist = plist.parse(fs.readFileSync(projectName + '-Info.plist', 'utf8'));

  var found = false;
  if (infoPlist.CFBundleURLTypes) {
    infoPlist.CFBundleURLTypes.forEach(function (curValue) {
      if (curValue.CFBundleURLSchemes) {
        curValue.CFBundleURLSchemes.forEach(function (curValue2) {
          if (curValue2 == '${PRODUCT_BUNDLE_IDENTIFIER}.payments') {
            found = true;
          }
        });
      }
    });
  } else {
    infoPlist.CFBundleURLTypes = new Array();
  }

  if (!found) {
    infoPlist.CFBundleURLTypes.push({ 'CFBundleTypeRole': 'Editor', 'CFBundleURLSchemes': ['${PRODUCT_BUNDLE_IDENTIFIER}.payments'] });
    fs.writeFileSync(projectName + '-Info.plist', plist.build(infoPlist), { encoding: 'utf8' });
  }

  process.chdir('../../../');
};

function hasShellScript(myProj) {
  if (!myProj.hash.project.objects.PBXShellScriptBuildPhase) { return false; }

  let found = false;
  Object.keys(myProj.hash.project.objects.PBXShellScriptBuildPhase).forEach((scriptKey) => {
    if (scriptKey.indexOf('_comment') >= 0) { return; }
    const shellObj = myProj.hash.project.objects.PBXShellScriptBuildPhase[scriptKey];
    const { name, shellScript } = shellObj;
    const nameMatches = name === '"Run Script"' || name === '"[cordova-plugin-braintree]: Run Script -- Strip architectures"';
    const scriptMatches = (shellScript || '').indexOf('This script loops through the frameworks') >= 0;
    if (nameMatches && scriptMatches) {
      found = true;
    }
  });

  return found;
}

function fromDir(startPath, filter, rec, multiple) {
  if (!fs.existsSync(startPath)) {
    console.log('[cordova-plugin-braintree] ==> no project dir found', startPath);
    return;
  }

  const files = fs.readdirSync(startPath);
  var resultFiles = [];
  for (var i = 0; i < files.length; i++) {
    var filename = path.join(startPath, files[i]);
    var stat = fs.lstatSync(filename);
    if (stat.isDirectory() && rec) {
      fromDir(filename, filter); // recurse
    }

    if (filename.indexOf(filter) >= 0) {
      if (multiple) {
        resultFiles.push(filename);
      } else {
        return filename;
      }
    }
  }
  if (multiple) {
    return resultFiles;
  }
}

function getFileIdAndRemoveFromFrameworks(myProj, fileBasename) {
  var fileId = '';
  const pbxFrameworksBuildPhaseObjFiles = myProj.pbxFrameworksBuildPhaseObj(myProj.getFirstTarget().uuid).files;
  for (var i = 0; i < pbxFrameworksBuildPhaseObjFiles.length; i++) {
    var frameworkBuildPhaseFile = pbxFrameworksBuildPhaseObjFiles[i];
    if (frameworkBuildPhaseFile.comment && frameworkBuildPhaseFile.comment.indexOf(fileBasename) != -1) {
      fileId = frameworkBuildPhaseFile.value;
      pbxFrameworksBuildPhaseObjFiles.splice(i, 1); // MUST remove from frameworks build phase or else CodeSignOnCopy won't do anything.
      break;
    }
  }
  return fileId;
}

function getFileRefFromName(myProj, fName) {
  const fileReferences = myProj.hash.project.objects['PBXFileReference'];
  var fileRef = '';
  for (var ref in fileReferences) {
    if (ref.indexOf('_comment') == -1) {
      var tmpFileRef = fileReferences[ref];
      if (tmpFileRef.name && tmpFileRef.name.indexOf(fName) != -1) {
        fileRef = ref;
        break;
      }
    }
  }
  return fileRef;
}

function addRunpathSearchBuildProperty(proj, build) {
  const LD_RUNPATH_SEARCH_PATHS = proj.getBuildProperty('LD_RUNPATH_SEARCH_PATHS', build);
  if (!LD_RUNPATH_SEARCH_PATHS) {
    proj.addBuildProperty('LD_RUNPATH_SEARCH_PATHS', '"$(inherited) @executable_path/Frameworks"', build);
  } else if (LD_RUNPATH_SEARCH_PATHS.indexOf('@executable_path/Frameworks') == -1) {
    var newValue = LD_RUNPATH_SEARCH_PATHS.substr(0, LD_RUNPATH_SEARCH_PATHS.length - 1);
    // eslint-disable-next-line no-useless-escape
    newValue += ' @executable_path/Frameworks\"';
    proj.updateBuildProperty('LD_RUNPATH_SEARCH_PATHS', newValue, build);
  }
}
