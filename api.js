'use strict'

//Dependencies

let Promise = require('bluebird');

let moment = require('moment');

//API

module.exports = function (options) {

    let client = options.client;

    //ADD UPLOADER
    this.add('role:user,cmd:add-uploader', (msg, respond) => {
        let promNextUserID = client.getAsync('next_user_id');
        let promNextVideoID = client.getAsync('next_video_id');

        let promAddUser = Promise.join(promNextUserID, promNextVideoID, (nextUserID, nextVideoID) => {
            if (nextUserID != 0 && !nextUserID) {
                return Promise.reject(new Error("Error on nextUserID"));
            }
            if (nextVideoID != 0 && !nextVideoID) {
                return Promise.reject(new Error("Error on nextVideoID"));
            }

            return client.hmsetAsync(`user:${nextUserID}`, {
                'name': msg.user.name,
                'id_video': nextVideoID,
                'date_started': moment().format() });  //date format moment.js ISO : '2016-08-02T15:44:09-05:00'
        });

        let promAddVideo = Promise.join(promNextVideoID, promNextUserID, (nextVideoID, nextUserID) => {
            if (nextVideoID != 0 && !nextVideoID) {
                return Promise.reject(new Error("Error on nextVideoID"));
            }
            if (nextUserID != 0 && !nextUserID) {
                return Promise.reject(new Error("Error on nextUserID"));
            }

            return client.hmsetAsync(`video:${nextVideoID}`, {
                'title': msg.video.title,
                'id_user': nextUserID });
        });

        Promise.join(promNextUserID, promAddUser, (nextUserID) => { return client.lpushAsync(`user:${nextUserID}:servers`, ['TODO Need server decision here']) } )
        Promise.join(promNextVideoID, promAddVideo, (nextVideoID) => { return client.lpushAsync(`video:${nextVideoID}:tags`, msg.video.tags) } )
        .then(() => {return client.incrAsync('next_user_id')})
        .then(() => {return client.incrAsync('next_video_id')})
        .then(() => {return new Promise( () => respond(null, { 'code': 200 , 'status': "User added succesfully." }), null )} )
        .catch(err => {
            respond(`Error on adding uploader: ${err}`, { 'code': 500 , 'status': null });
        })
    })

    this.add('role:user,cmd:del', (msg, respond) => {
      respond(null, { 'status': 'OK del' })
    })

}
