'use strict';

/* Services */

angular.module('talk2us.services', []).
factory('socketio', function($rootScope){
    var socket = io.connect(null,{'force new connection':true});
    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            })
        }
    };
}).
factory('webrtc', [ "$rootScope",  "$window", "socketio", function($rootScope, win, socketio) {
    var localStream = null,
        peerConn = null,
        debugEnabled = true,
        role = 'client',
        stunServer = 'stun:stun.l.google.com:19302';

    var nav = win.navigator;

    nav.getUserMedia = nav.getUserMedia ||
                            nav.webkitGetUserMedia ||
                            nav.mozGetUserMedia ||
                            nav.msGetUserMedia;

    win.RTCPeerConnection = win.RTCPeerConnection ||
                                win.webkitRTCPeerConnection ||
                                win.mozRTCPeerConnection;

    win.RTCSessionDescription = win.RTCSessionDescription ||
                                    win.mozRTCSessionDescription;

    win.RTCIceCandidate = win.RTCIceCandidate ||
                            win.mozRTCIceCandidate;

    return {
        open: function (config, eventCallback) {
            nav.getUserMedia({audio: config.audio, video: config.video}, function(stream){
                localStream = stream;
                registerForPeerMessages();
                $rootScope.$apply(function () {
                    callback.apply(this, ['LOCALSTREAM',win.URL.createObjectURL(localStream)]);
                });
            }, function () {
                console.log('No permission to access camera/mic');
                $rootScope.$apply(function () {
                    callback.apply(this, ['LOCALSTREAM',null]);
                });
            });
            role = config.role;
            debug('Logged in the role of ' + role);
        },

        connect: function(config) {
            if (role === 'client') {
                peerConn = createPeerConnection();
                peerConn.addStream(localStream);

                var sdpConstraints = {'mandatory': {
                    'OfferToReceiveAudio': true,
                    'OfferToReceiveVideo': true
                }};


                peerConn.createOffer(function(sessionDescription) {
                    peerConn.setLocalDescription(sessionDescription);
                    var msg = {};
                    msg.msg_type = 'OFFER';
                    msg.data = sessionDescription;
                    socketio.send(JSON.stringify(msg));
                }, null, sdpConstraints);
            }
        },

        set: function(config) {
           //mute and camera off messages here
        },

        close: function(config) {
            var msg = {};
            msg.msg_type = 'HANGUP';
            socketio.send(JSON.stringify(msg));

            if (peerConn) {
                peerConn.close();
            }
        }
    }

    function registerForPeerMessages() {
        socketio.on('OFFER', function (msg) {
            if (role === 'provider') {
                peerConn = createPeerConnection();
                peerConn.setRemoteDescription(
                    new RTCSessionDescription(msg.data)
                );
                peerConn.addStream(localStream);            //localStream, is it available always?
                var sdpConstraints = {'mandatory': {
                    'OfferToReceiveAudio': true,
                    'OfferToReceiveVideo': true
                }};

                peerConn.createAnswer(sendAnswer, null, sdpConstraints);
            } else {
                debug('Error: OFFER received by CLIENT');
            }
            //indicate controller of message
            var args = ['OFFER'].concat(arguments);
            $rootScope.$apply(function () {
                callback.apply(this, args);
            });
        });

        socketio.on('ANSWER', function (msg) {
            if (role === 'client') {
                peerConn.setRemoteDescription(
                    new RTCSessionDescription(msg.data)
                );
            } else {
                debug('Error: ANSWER received by PROVIDER');
            }
            //indicate controller of message
            var args = ['ANSWER'].concat(arguments);
            $rootScope.$apply(function () {
                callback.apply(this, args);
            });
        });

        socketio.on('HANGUP', function (msg) {
            peerConn.close();
            //indicate controller of hangup
            var args = ['HANGUP'].concat(arguments);
            $rootScope.$apply(function () {
                callback.apply(this, args);
            });
        });

        socketio.on('CANDIDATE', function (msg) {
            var candidate = new RTCIceCandidate({candidate: msg.candidate});
            peerConn.addIceCandidate(candidate);
        });
    }

    function debug(s) {
        if (debugEnabled) {
            console.log(s);
        }
    }

    function sendAnswer(sessionDescription) {
        peerConn.setLocalDescription(sessionDescription);
        var msg = {};
        msg.msg_type = 'ANSWER';
        msg.data = sessionDescription;
        socketio.send(JSON.stringify(msg));
    }

    function createPeerConnection() {
        var peerConn = new RTCPeerConnection(
            {'iceServers': [{'url': stunServer}]}
        );

        peerConn.onicecandidate = onIceCandidate;
        peerConn.onconnecting = onSessionConnecting;
        peerConn.onopen = onSessionOpened;

        peerConn.onaddstream = function(event) {
            debug('Remote stream added');
            var url = win.URL.createObjectURL(event.stream);
            debug('createPeerConnection: url = ' + url);
            //indicate controller of remote url
            $rootScope.$apply(function () {
                callback.apply(this, ['REMOTESTREAM',url]);
            });

        };
        return peerConn;
    }

    function onIceCandidate(event){
        if (event.candidate) {
            debug('Sending ICE candidate to remote peer: ' +
                event.candidate.candidate);
            var msgCandidate = {};
            msgCandidate.msg_type = 'CANDIDATE';
            msgCandidate.candidate = event.candidate.candidate;
            socketio.send(JSON.stringify(msgCandidate));
        } else {
            debug('onIceCandidate: no candidates');
        }
    }

    function onSessionConnecting(message) {
        debug('onSessionConnecting ...');
    }

    function onSessionOpened(message) {
        debug('onSessionOpened ...');
    }
}]);