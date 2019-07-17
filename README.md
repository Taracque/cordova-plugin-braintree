# NOTE
This repo is a fork of https://github.com/taracque/cordova-plugin-braintree. All active development should point to there - this repo exists only so that I can keep pushing this plugin forward while Taracque maintains the stable branch.

For support please refer to that repo, not to this one. I cannot guarantee I will answer. Feel free to submit PR's, however, and I will do my best to get them both into this code and back into Taracque's fork.

# Braintree Cordova Plugin

This is a [Cordova](http://cordova.apache.org/) plugin for the [Braintree](https://www.braintreepayments.com/) mobile payment processing SDK.

This version of the plugin uses versions `4.14.0` (iOS) and `2.12.0` (Android) of the Braintree mobile SDK. Documentation for the Braintree SDK can be found [here](https://developers.braintreepayments.com/start/overview). Before start using this plugin please read that documentation.

**This plugin is still in development.**

# Install

Please ensure you are on a reasonably recent version of Node. The install script uses ES6 features that require at least node 8.

Be sure, that plist and xcode npm module is installed:
```bash
    npm install plist
    npm install xcode
```

To add the plugin to your Cordova project, first remove the iOS platform, install the latest version of the plugin directly from git, and then re-add iOS platform

```bash
    cordova platform remove ios
    cordova plugin add https://github.com/engineerapart/cordova-plugin-braintree
    cordova platform add ios
```

## Note
Due to confusing behavior in Cordova (it isn't - but can seem like it is) I strongly recommend adding the following hook to your project's config.xml file, OUTSIDE of the `<platform></platform>` tags (inside the `<widget>` tag):

``` xml
<hook src="plugins/cordova-plugin-braintree/scripts/add_embedded_ios_frameworks.js" type="before_prepare" />
```

This will ensure that the script ALWAYS runs no matter what platform you are preparing or at what stage. You should only need to run `cordova prepare` once after running npm install if you find that the script doesn't exist in XCode.

You can check that the script exists by opening your project in Xcode and going to `Your Project -> Build Phases` and looking for the `[cordova-plugin-braintree]: Run Script -- Strip architectures` shell script entry. If it is there, you are golden; otherwise, you'll need to run `cordova prepare`.


# Usage

The plugin is available via a global variable named `BraintreePlugin`. It exposes the following properties and functions.

All functions accept optional success and failure callbacks as their last two arguments, where the failure callback will receive an error string as an argument unless otherwise noted.

A TypeScript definition file for the JavaScript interface is available in the `typings` directory as well as on [DefinitelyTyped](https://github.com/borisyankov/DefinitelyTyped) via the `tsd` tool.

## Initialize Braintree Client ##

Used to initialize the Braintree client. The client must be initialized before other methods can be used.

Method Signature:

`initialize(token, successCallback, failureCallback)`

Parameters:

* `token` (string): The unique client token or static tokenization key to use.

Example Usage:

```
var token = "YOUR_TOKEN";

BraintreePlugin.initialize(token,
    function () {
        console.log("init OK!");
        ...
    },
    function (error) { console.error(error); });
```
*As the initialize code is async, be sure you called all Braintree related codes after successCallback is called!*

## Show Drop-In Payment UI ##

Used to show Braintree's drop-in UI for accepting payments.

Method Signature:

`presentDropInPaymentUI(options, successCallback, failureCallback)`

Parameters:

* `options` (object): An optional argument used to configure the payment UI; see type definition for parameters.

Example Usage:

```
var options = {
    amount: "49.99",
    primaryDescription: "Your Item"
};

BraintreePlugin.presentDropInPaymentUI(options, function (result) {

    if (result.userCancelled) {
        console.debug("User cancelled payment dialog.");
    }
    else {
        console.info("User completed payment dialog.");
        console.info("Payment Nonce: " + result.nonce);
        console.debug("Payment Result.", result);
    }
});
```

## Apple Pay (iOS only) ##

Do not turn on Apple Pay in Braintree if you don't have Apple Pay entitlements.
To allow ApplePay payment you need to initialize Apple Pay framework before usign the Drop/In Payment UI. Read Braintree docs to setup Merchant account: https://developers.braintreepayments.com/guides/apple-pay/configuration/ios/v4#apple-pay-certificate-request-and-provisioning

Method Signature:
`setupApplePay(options)`

Paramteres:

* `options` (object): Merchant settings object, with the following keys:
    *   `merchantId` (string): The merchant id generated on Apple Developer portal.
    *   `currency` (string): The currency for payment, 3 letter code (ISO 4217)
    *   `country` (string): The country code of merchant's residence. (ISO 3166-2)

Example Usage:

```
BraintreePlugin.setupApplePay({ merchantId : 'com.braintree.merchant.sandbox.demo-app', country : 'US', currency : 'USD'});
```

ApplePay shown in Drop-In UI only if `BraintreePlugin.setupApplePay` called before `BraintreePlugin.presentDropInPaymentUI`

## Troubleshooting
If you are using Cordova IOS < 5.0, you might need this change in a related repository:
[https://github.com/fbognini/cordova-plugin-braintree/commit/2ea9150ed4a61ad4cc352d3240f4c8cd2f863a43](https://github.com/fbognini/cordova-plugin-braintree/commit/2ea9150ed4a61ad4cc352d3240f4c8cd2f863a43)

We maintain an ongoing maintenance conversation here:
[https://github.com/Taracque/cordova-plugin-braintree/pull/47](https://github.com/Taracque/cordova-plugin-braintree/pull/47)
