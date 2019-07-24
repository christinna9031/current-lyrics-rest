/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const cheerio = require('cheerio');

var client_id = '1964b3c633b64c649c58659dc56bff63'; 
var client_secret = '#'; 
var redirect_uri = 'http://192.168.2.217:8888/callback'; 

const geniusClientToken = 'cKWPv6dBpVeM03wkOQGIB2fyx-NEYklOCcQ7VVxvcArO_KZO-goQ9doN9z9U_u3N';

const geniusLink = 'https://genius.com/';

let access_token_current;

const createGeniusQuery = function(item) {
    const artist = item.artists[0].name.split(' ').join('-');
    const song = item.name;


    return [artist, song];

}



/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  var scope = 'user-read-private user-read-email user-read-playback-state user-read-currently-playing';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/get', function(req, res) {
    
    var options = {
        url: 'https://api.spotify.com/v1/me/player/currently-playing',
        headers: { 'Authorization': 'Bearer ' + access_token_current },
        json: true
    };

    request.get(options, function(error, response, body) {
        if (!body || !body.item) {
          res.status(404).end('No song currently played');
            return;
        }
      queryGenius = createGeniusQuery(body.item);
      let geniusOptions = {
          url: 'https://api.genius.com/search?' + querystring.stringify({
              q: queryGenius.join(' ')
          }),
          headers: {'Authorization': 'Bearer ' + geniusClientToken},
          json: true
      }
      request.get(geniusOptions, function(error, response, body) {
        if (!body || !body.response || !body.response.hits) {
          res.status(404).end('No song currently played');
          return;
        }
          const songGenius = body.response.hits[0].result.url;
          request.get(songGenius, function(error, response, body) {
            if (error) throw error;
            const $ = cheerio.load(body);
            let lyrics = $('.lyrics').text().trim();
            res.end(lyrics);
        })
      })
      
    });

})

app.get('/callback', function(req, res) {

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

            access_token_current = access_token;

        var options = {
          url: 'https://api.spotify.com/v1/me/player/currently-playing',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        let queryGenius;
        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
            if (!body || !body.item) {
                res.status('404').end('No song currently played');
                return;
            }
          queryGenius = createGeniusQuery(body.item);
          let geniusOptions = {
              url: 'https://api.genius.com/search?' + querystring.stringify({
                  q: queryGenius.join(' ')
              }),
              headers: {'Authorization': 'Bearer ' + geniusClientToken},
              json: true
          }
          request.get(geniusOptions, function(error, response, body) {
            if (!body || !body.response || !body.response.hits) {
              res.status(404).end('No song currently played');
              return;
            }
              const songGenius = body.response.hits[0].result.url;
              request.get(songGenius, function(error, response, body) {
                if (error) throw error;
                const $ = cheerio.load(body);
                let lyrics = $('.lyrics').text().trim();
                res.end(lyrics);
            })
          })
          
        });
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
