/*jslint node: true */
/*jshint esversion: 6 */
'use strict';

let express = require('express');
let bodyParser = require('body-parser');

module.exports = (options) => {

    let service = options.service;
    let router = express.Router();

    router.post('/servers/load', function (req, res) {
        let data = req.body;

        //{ "id_uploader": int, "title": string , "tags": string array}
        console.log(data);

        res.sendStatus(200);
    });

    return router;
};
