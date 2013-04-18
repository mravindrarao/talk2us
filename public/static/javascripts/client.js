var serverAddr = '192.168.2.103'
  , serverPort = 3000
  , stunServer = 'stun:stun.l.google.com:19302'
  , socket = null
  , peerConn = null
  , localStream = null
  , role = 'CLIENT'
  , room = 'CHATROOM';

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

window.RTCPeerConnection = window.RTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    window.mozRTCPeerConnection;

window.RTCSessionDescription = window.RTCSessionDescription ||
    window.mozRTCSessionDescription;

window.RTCIceCandidate = window.RTCIceCandidate ||
    window.mozRTCIceCandidate;

window.onload = function() {
    var video = $('#local-video');
    navigator.getUserMedia({audio: true, video: true}, function(stream){
        localStream = stream;
        video.attr('src', window.URL.createObjectURL(localStream));
        connectbtn.disabled = false;
    }, accessRejected);
};

function accessRejected() {
    console.log('No permission to access camera/mic');
    connectbtn.disabled = true;
}

function connect() {
    socket = new WebSocket('ws://' + serverAddr + ':' + serverPort,
                          'talk2us');
    if (socket) {
        connectbtn.disabled = true;
        hangupbtn.disabled = false;
    }
    socket.onopen = function() {
        sendRoom();
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
            socket.send(JSON.stringify(msg));
        }, null, sdpConstraints);
    };

    socket.onerror = function(error) {
        connectbtn.disabled = false;
        hangupbtn.disabled = true;
        console.log('Socket error: ' + error + ' for ' + role);
    };

    socket.onclose = function() {
        connectbtn.disabled = false;
        hangupbtn.disabled = true;
        console.log("Socket closed for " + role);
    };

    socket.onmessage = function(event) {
        var msg = JSON.parse(event.data);
        console.log('Received message type: ' + msg.msg_type);

        switch(msg.msg_type) {
            
        case 'ANSWER':
            peerConn.setRemoteDescription(
                new RTCSessionDescription(msg.data)
            );
            break;

        case 'HANGUP':
            peerConn.close();
            socket.close();
            connectbtn.disabled = false;
            hangupbtn.disabled = true;
            break;

        case 'CANDIDATE':
            var candidate = new RTCIceCandidate({candidate: msg.candidate});
            peerConn.addIceCandidate(candidate);
            break;

        default:
            console.log('Unknown message ' + msg.msg_type);
            break;
        }
    };

    function sendRoom() {
        var msg = {};
        msg.msg_type = 'ROOM';
        msg.room = room;
        msg.role = role;
        socket.send(JSON.stringify(msg));
    }

    function onIceCandidate(event){
        if (event.candidate) {
            console.log('Sending ICE candidate to remote peer: ' + 
                       event.candidate.candidate);
            var msgCandidate = {};
            msgCandidate.msg_type = 'CANDIDATE';
            msgCandidate.candidate = event.candidate.candidate;
            socket.send(JSON.stringify(msgCandidate));
        } else {
            console.log('onIceCandidate: no candidates');
        }
    }

    function onSessionConnecting(message) {
        console.log('onSessionConnecting ...');
    }

    function onSessionOpened(message) {
        console.log('onSessionOpened ...');
    }

    function onRemoteStreamRemoved(event) {
        console.log('onRemoteStreamRemoved ...');
    }

    function createPeerConnection() {
        var peerConn = new RTCPeerConnection(
            {'iceServers': [{'url': stunServer}]}
        );

        peerConn.onicecandidate = onIceCandidate;
        peerConn.onconnecting = onSessionConnecting;
        peerConn.onopen = onSessionOpened;

        peerConn.onaddstream = function(event) {
            console.log('Remote stream added');
            var url = window.URL.createObjectURL(event.stream);
            console.log('createPeerConnection: url = ' + url);
            $('#remote-video').attr('src', url);
        };
        return peerConn;
    }
}

function hangup() {
    connectbtn.disabled = false;
    hangupbtn.disabled = true;

    var msg = {};
    msg.msg_type = 'HANGUP';
    socket.send(JSON.stringify(msg));

    peerConn.close();
    socket.close();
}

