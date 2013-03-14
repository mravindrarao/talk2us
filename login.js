window.fbAsyncInit = function() {
    // init the FB JS SDK
    FB.init({
        appId      : '558449554176735', // App ID from the App Dashboard
        //      channelUrl : 'localhost/channel.html', // Channel File for x-domain communication
        status     : true, // check the login status upon init?
        cookie     : true, // set sessions cookies to allow your server to access the session?
        xfbml      : true, // parse XFBML tags on this page?
        oauth      : true
    });

    // Additional initialization code such as adding Event Listeners
    // goes here

    FB.Event.subscribe('auth.login', function(response) {
        console.log('The status of the session is: ' + response.status);
        if (response.status == 'connected') {
            console.log("User id: " + response.authResponse.userID);
            document.getElementById('logout-btn').style.visibility = 'visible';
            var loginBlock = document.getElementById('login-box');
            document.body.removeChild(loginBlock);
            FB.api('/me', function(response) {
                createTextElem('Welcome, ' + response.name, document.body);
//                console.log('Email id: ' + response.email);
            });

        }
    });


    console.log("Init done");
};

// Load the SDK's source Asynchronously
// Note that the debug version is being actively developed and might 
// contain some type checks that are overly strict. 

(function(d, debug){
    var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement('script'); js.id = id; js.async = true;
    js.src = "//connect.facebook.net/en_US/all" + (debug ? "/debug" : "") + ".js";
    ref.parentNode.insertBefore(js, ref);


}(document, /*debug*/ true));


function logoutUser() {
    FB.logout(function(response) {
        console.log('Logged out user');
        document.getElementById('logout-btn').style.visibility = 'hidden';
        createTextElem('Thank you for using Talk2Us', document.body);
    });
}


function createTextElem(htmlStr, parent) {
    var para = document.createElement('p');
    var node = document.createTextNode(htmlStr);
    para.appendChild(node);
    parent.appendChild(para);
}


