'use strict';

const Homey = require('homey');
const logger = require('homey-log').Log;

const icons = [
	'S1', // Play:1
	'S13', // Play One
	'S3', // Play:3
	'S5', // Play:5
	'S9', // Playbar
	'ZP100',
	'ZP120', // Connect:Amp
	'ZP90', // Connect
	//	'SUB'
];
const urlParser = /^http:\/\/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{1,5})/i;

const PLAYLIST_REFRESH_TIMEOUT = 60 * 60 * 1000;

module.exports = class SonosDriver extends Homey.Driver {

	onInit() {
		this._searchResults = {};
		this.api = Homey.app.getApi();

		this.listDevicesTimeout = 20000;

		// Homey.ManagerFlow
		// 	.on('condition.playback_state', this._onFlowConditionPlaybackState.bind(this))
		// 	.on('action.group_volume_mute', this._onFlowActionGroupVolumeMute.bind(this))
		// 	.on('action.group_volume_unmute', this._onFlowActionGroupVolumeUnmute.bind(this));
	}

	getPlayers() {
		return this.api.getPlayers();
	}

	/**
	 * Encodes characters not allowed within html/xml tags
	 * @param  {String} str
	 * @return {String}
	 */
	htmlEntities(str) {
		return String(str)
			.replace(/&(?!#?[a-z0-9]+;)/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	parseUri(str) {
		return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
	}

	parseUrl(url) {
		const match = urlParser.exec(url);
		if (!match) return false;
		return {
			host: match[1],
			port: match[2],
		};
	}
	//
	// _initDevice(deviceData) {
	// 	this.log('_initDevice', deviceData);
	//
	// 	const searchResult = this._searchResults[deviceData.sn];
	// 	if (searchResult) {
	// 		console.log('found sonos', searchResult);
	//
	// 		if (this._devices[deviceData.sn] && this._devices[deviceData.sn].pollInterval) {
	// 			clearInterval(this._devices[deviceData.sn].pollInterval);
	// 		}
	//
	// 		const conn = this._getConnection(searchResult);
	//
	// 		const device = {
	// 			_sonos: conn,
	// 			sonos: conn,
	// 			state: {
	// 				speaker_playing: false,
	// 			},
	// 			deviceData,
	// 		};
	// 		this._devices[deviceData.sn] = device;
	// 		this.getUPnPClient(device);
	//
	// 		this._syncSonosMasterNodes(device);
	//
	// 		const pollState = () => {
	// 			[
	// 				{ fn: this._compareTrack.bind(this, device) },
	// 				{ id: 'volume_set', fn: device.sonos.getVolume.bind(device.sonos), parse: vol => vol / 100 },
	// 				{ id: 'volume_mute', fn: device.sonos.getMuted.bind(device.sonos) },
	// 				// { id: 'get_queue' },
	// 			].forEach(capability =>
	// 				capability.fn((err, state) => {
	// 					if (err) return Homey.error(err);
	//
	// 					state = capability.parse ? capability.parse(state) : state;
	//
	// 					if (capability.id) {
	// 						device.state[capability.id] = state;
	// 						this.realtime(deviceData, capability.id, state);
	// 					}
	// 					if (capability.onResult) {
	// 						capability.onResult(err, state);
	// 					}
	// 				})
	// 			);
	// 		};
	//
	// 		device.pollInterval = setInterval(pollState, 5000);
	//
	// 		logger.setExtra({ devices: this._devices });
	//
	// 		// device.sonos.play({ uri: 'spotify:track:7BKLCZ1jbUBVqRi2FVlTVw' }, console.log.bind(null, 'PLAY'));
	// 		// this._playUrl(device, {
	// 		// 	// stream_url: 'https://api.soundcloud.com/tracks/92285620/stream?client_id=c39d675784ad098e33ae68ca8057154c',
	// 		// 	stream_url: 'https://chromecast.athomdev.com/song.mp3?client_id=c39d675784ad098e33ae68ca8057154c&amp;test=true',
	// 		// 	// stream_url: 'http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=32&client=tw-ob&q=Hi%20this%20is%20a%20test&tl=En-gb',
	// 		// 	// stream_url: 'https://cf-media.sndcdn.com/FLlfJVV2cQJn.128.mp3?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiKjovL2NmLW1lZGlhLnNuZGNkbi5jb20vRkxsZkpWVjJjUUpuLjEyOC5tcDMiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE0ODUxNzk0ODB9fX1dfQ__&Signature=CG4u-7lNQBopRdlgP6-giJbbw4KXH7FXYQtwuB6hU~fcshUmzxFL7O7yVcPY-4W6VzujkIV~EIzkpXFX8RaWkJ0j2NqO7XGaKyWVfSxqz70E8YGvuomwaY9oHdh5Rahm0FOuKPaGEfvqJx5WD7wauWcrEb6VNVKJgkoTp6jAYOukIw5MtB5Mob5NHwuydBefocryt4z3tcbYOybp40BZyV9gUcbEqyLkNHrY8PnBbaAJ26C4UDwI8PoWUU5kua8OW-mJhY4bmHcfw0qkjK89GmUVC-z8AVEiPCVRxl6avmVXcRnmPjRYkJQmNM0h0JwRF7Yx6UrcrOyZ6Bf1Aal1WA__&Key-Pair-Id=APKAJAGZ7VMH2PFPW6UQ',
	// 		// 	// stream_url: 'https://r2---sn-5hne6nlr.c.doc-0-0-sj.sj.googleusercontent.com/videoplayback?id=ee712c3184908c23&itag=25&source=skyjam&begin=0&upn=5CIuIIfpFnQ&o=06776416745300621078&cmbypass=yes&ratebypass=yes&ip=217.114.108.248&ipbits=0&expire=1485188656&sparams=cmbypass,expire,id,ip,ipbits,itag,mm,mn,ms,mv,nh,o,pl,ratebypass,source,upn&signature=58AD2D61EB006E366961E276BF0CB80ACC14AB32.5661448B95FC48BCFFBF1EBCF542589042B2E4E3&key=cms1&mm=31&mn=sn-5hne6nlr&ms=au&mt=1485188449&mv=m&nh=IgpwcjA0LmFtczE1KgkxMjcuMC4wLjE&pl=20',
	// 		// 	title: 'TIROL',
	// 		// 	duration: 78000,
	// 		// 	artwork: {
	// 		// 		medium: 'https://pbs.twimg.com/profile_images/608222870708224001/WRlSqpdh.jpg',
	// 		// 	},
	// 		// }, console.log.bind(null, 'PLAY'));
	// 		// // this._playSpotify(device, '7BKLCZ1jbUBVqRi2FVlTVw', console.log.bind(null, 'QUEUE'));
	//
	// 		// this._playSoundCloud(device, null, console.log.bind('PLAYSOUNDCLOUD'));
	//
	//
	// 		this.registerSpeaker(deviceData, {
	// 			codecs: ['homey:codec:mp3', 'sonos:track:uri', 'spotify:track:id'],
	// 		}, (err, speaker) => {
	// 			if (err) return Homey.error(err);
	// 			device.speaker = speaker;
	// 			speaker.on('setTrack', this._setTrack.bind(this, device));
	// 			speaker.on('setPosition', (position, callback) => {
	// 				device.sonos.seek(Math.round(position / 1000), (err) => {
	// 					if (err) return callback(err);
	// 					callback(null, position);
	// 				});
	// 			});
	// 			speaker.on('setActive', (isActive, callback) => {
	// 				if (isActive) {
	// 					setTimeout(Homey.manager('media').requestPlaylistsUpdate, 10000);
	// 				}
	// 				device.isActiveSpeaker = isActive;
	// 				device.lastTrack = undefined;
	// 				return callback(null, isActive);
	// 			});
	// 		});
	//
	// 		// device.sonos.getMusicLibrary('sonos_playlists', {}, console.log.bind(null, 'library'));
	// 		//
	// 		// device.sonos.searchMusicLibrary('sonos_playlists', '0', {}, console.log.bind(null, 'tracks'));
	//
	// 		this.emit('device_inited', device);
	// 	} else {
	// 		this.on(`found:${deviceData.sn}`, () => {
	// 			this._initDevice(deviceData);
	// 		});
	// 	}
	// }

	// _getConnection(location) {
	// 	const connKey = location.host + location.port;
	// 	return connectionMap.has(connKey) ?
	// 		connectionMap.get(connKey) :
	// 		connectionMap.set(connKey, new sonos.Sonos(location.host, location.port)).get(connKey);
	// }

	// _syncSonosMasterNodes() {
	// 	const syncMasterNodes = () => {
	// 		const deviceId = Object.keys(this._devices)[0];
	// 		if (!deviceId) return;
	// 		this._devices[deviceId].sonos.getTopology((err, topology) => {
	// 			if (err) return;
	//
	// 			const coordinators = {};
	// 			const groupConnections = {};
	// 			const groups = topology.zones.map(zone => {
	// 				const group = {
	// 					coordinator: zone.coordinator,
	// 					group: zone.group,
	// 					location: parseUrl(zone.location),
	// 				};
	// 				if (!group.location) return null;
	// 				group.device = this._devices[Object.keys(this._devices)
	// 					.find(key =>
	// 						this._devices[key]._sonos.host === group.location.host &&
	// 						Number(this._devices[key]._sonos.port) === Number(group.location.port)
	// 					)];
	// 				if (group.coordinator) {
	// 					coordinators[group.group] = group;
	// 				}
	// 				groupConnections[group.group] = groupConnections[group.group] || [];
	// 				groupConnections[group.group].push(this._getConnection(group.location));
	// 				return group;
	// 			});
	//
	// 			groups.forEach(group => {
	// 				if (!group) return;
	// 				const conn = this._getConnection(coordinators[group.group].location);
	// 				if (group.device) {
	// 					group.device.sonos = conn;
	// 					group.device.group = groupConnections[group.group];
	// 				}
	// 			});
	// 		});
	// 	};
	// 	syncMasterNodes();
	// 	if (this._syncMasterNodesInterval) {
	// 		clearInterval(this._syncMasterNodesInterval);
	// 	}
	// 	this._syncMasterNodesInterval = setInterval(syncMasterNodes, 5000);
	// }

	// _setTrack(device, data, cb) {
	// 	const track = data.track;
	// 	const callback = (err, result) => {
	// 		console.log('SETTRACK RESULT', err, result);
	// 		device.trackQueued = false;
	// 		cb(err, result);
	// 	};
	// 	device.lastTrack = undefined;
	// 	// if (track.player_uri === 'homey:app:com.google.music') {
	// 	// 	return callback(new Error('Unable to play google play music tracks'));
	// 	// }
	// 	device.trackQueued = Boolean(data.opts.delay);
	// 	console.log('set track', data);
	//
	// 	const getCurrTrack = () => {
	// 		device.sonos.currentTrack((err, currentTrack) => {
	// 			console.log('got track info', err, currentTrack);
	// 			if (err) return callback(err);
	// 			device.lastTrack = currentTrack;
	// 			this.realtime(device.deviceData, 'speaker_playing', data.opts.startPlaying);
	// 			if (!track.duration) {
	// 				track.duration = currentTrack.duration * 1000;
	// 			}
	// 			device.speaker.updateState({ position: (currentTrack || {}).position * 1000, track: track });
	// 			callback(null, true);
	// 		});
	// 	};
	//
	// 	const setPosition = () => {
	// 		if (data.opts.position) {
	// 			device.sonos.seek(Math.round(data.opts.position / 1000), (err) => {
	// 				if (err) return callback(err);
	// 				getCurrTrack();
	// 			});
	// 		} else {
	// 			getCurrTrack();
	// 		}
	// 	};
	//
	// 	const play = () => {
	// 		this.realtime(device.deviceData, 'speaker_playing', false);
	// 		switch (track.codec) {
	// 			case 'sonos:track:uri':
	// 				this._playSonosUri(device, track, data.opts, (err) => {
	// 					if (err) return callback(err);
	// 					setPosition();
	// 				});
	// 				break;
	// 			case 'spotify:track:id':
	// 				this._playSpotify(device, track.stream_url, data.opts, (err) => {
	// 					if (err) return callback(err);
	// 					setPosition();
	// 				});
	// 				break;
	// 			default:
	// 				this._playUPnPUrl(device, track, data.opts, (err) => {
	// 					if (err) return callback(err);
	// 					setPosition();
	// 				});
	// 		}
	// 	};
	// 	if (device.nextTrackCallback) {
	// 		device.nextTrackCallback(new Error('setTrack debounced'));
	// 		device.nextTrackCallback = null;
	// 		clearTimeout(device.nextTrackTimeout);
	// 	}
	// 	if (data.opts.delay) {
	// 		device.nextTrackCallback = callback;
	// 		device.nextTrackTimeout = setTimeout(() => {
	// 			device.nextTrackCallback = null;
	// 			play();
	// 		}, data.opts.delay);
	// 	} else {
	// 		play();
	// 	}
	// }
	//
	// _playUrl(device, track, opts, callback) {
	// 	const albumArt = track.artwork ? track.artwork.medium || track.artwork.large || track.artwork.small : null;
	// 	const duration = track.duration ? `${Math.floor(track.duration / 3600000)
	// 		}:${`0${Math.floor((track.duration % 3600000) / 60000)}`.slice(-2)
	// 		}:${`0${Math.round((track.duration % 60000) / 1000)}`.slice(-2)}` : null;
	// 	const protocolInfo = Driver.codecToProtocol(track.codec);
	// 	const uri = {
	// 		uri: htmlEntities(track.stream_url),
	// 		metadata: '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
	// 		'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" ' +
	// 		'xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dlna="urn:schemas-dlna-org:metadata-1-0/">' +
	// 		'<item id="f-0" parentId="0" restricted="0">' +
	// 		`<res ${duration ? `duration="${duration}"` : ''} ${protocolInfo ? `protocolInfo="${protocolInfo}"` : ''}>${track.stream_url}</res>` +
	// 		`<dc:title>${track.title || track.stream_url}</dc:title>` +
	// 		`<upnp:artist role="Performer">${
	// 		((track.artist || []).find(artist => artist.type === 'artist') || {}).name || ''}</upnp:artist>` +
	// 		`<upnp:album>${track.album || ''}</upnp:album>` +
	// 		(track.release_date ? `<dc:date>${track.release_date /* TODO */}</dc:date>` : '') +
	// 		(track.genre ? `<upnp:genre>${track.genre}</upnp:genre>` : '') +
	// 		(albumArt ? `<upnp:albumArtURI>${albumArt}</upnp:albumArtURI>` : '') +
	// 		'<upnp:class>object.item.audioItem.musicTrack</upnp:class>' +
	// 		'</item>' +
	// 		'</DIDL-Lite>',
	// 	};
	//
	// 	this._playUri(device, uri, opts, callback);
	// }
	//
	// _playSonosUri(device, track, opts, callback) {
	// 	const duration = track.duration ? `${Math.floor(track.duration / 3600000)
	// 		}:${`0${Math.floor((track.duration % 3600000) / 60000)}`.slice(-2)
	// 		}:${`0${Math.round((track.duration % 60000) / 1000)}`.slice(-2)}` : null;
	// 	const artist = ((track.artist || []).find(entry => entry.type === 'artist') || {}).name || '';
	// 	const trackUri = track.stream_url.split('!');
	// 	const uri = {
	// 		uri: htmlEntities(trackUri[1]),
	// 		metadata: '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
	// 		'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" ' +
	// 		'xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">' +
	// 		`<item id="${trackUri[0]}/${parseUri(trackUri[1])}:A${parseUri(track.title)},${parseUri(artist)},${parseUri(track.album)},${Math.round(track.duration / 1000)}" parentId="${trackUri[0]}" restricted="true">` +
	// 		`<res duration="${duration}"></res>` +
	// 		`<dc:title>${track.title || track.stream_url}</dc:title>` +
	// 		`<upnp:album>${track.album || ''}</upnp:album>` +
	// 		'<upnp:class>object.item.audioItem.musicTrack</upnp:class>' +
	// 		'<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">RINCON_AssociatedZPUDN</desc>' +
	// 		'</item>' +
	// 		'</DIDL-Lite>',
	// 	};
	//
	// 	this._playUri(device, uri, opts, callback);
	// }
	//
	// _playUri(device, uri, opts, callback) {
	// 	// if (delay) {
	// 	// 	device.sonos.queue(uri, (err, result) => {
	// 	// 		console.log('queueNext', err, result);
	// 	// 		callback(err, result);
	// 	// 	});
	// 	// } else {
	// 	device.sonos.flush(err => {
	// 		if (err) return console.log('flush err') & callback(err);
	// 		device.sonos.selectQueue(err => {
	// 			if (err) return console.log('selectQueue err') & callback(err);
	//
	// 			if (opts.startPlaying) {
	// 				device.sonos.play(uri, (err, result) => {
	// 					console.log('play', err, result);
	// 					callback(err, result);
	// 				});
	// 			} else {
	// 				device.sonos.queue(uri, (err, queueResult) => {
	// 					if (err || !queueResult || queueResult.length < 0 || !queueResult[0].FirstTrackNumberEnqueued) {
	// 						return callback(err);
	// 					}
	// 					const selectTrackNum = queueResult[0].FirstTrackNumberEnqueued[0];
	// 					device.sonos.selectTrack(selectTrackNum, callback);
	// 				});
	// 			}
	// 		});
	// 	});
	// 	// }
	// }
	//
	// _playUPnPUrl(device, track, opts, callback) {
	// 	// if (delay) {
	// 	// 	device.sonos.queue(uri, (err, result) => {
	// 	// 		console.log('queueNext', err, result);
	// 	// 		callback(err, result);
	// 	// 	});
	// 	// } else {
	// 	const client = this.getUPnPClient(device);
	//
	// 	this.realtime(device.deviceData, 'speaker_playing', false);
	// 	const artwork = (track.artwork || {});
	// 	new Promise((resolve, reject) =>
	// 		client.load(
	// 			track.stream_url,
	// 			{
	// 				contentType: 'audio/mpeg',
	// 				metadata: {
	// 					title: track.title,
	// 					duration: track.duration,
	// 					artist: (track.artist || []).find(artist => artist.type === 'artist'),
	// 					creator: (track.artist || []).map(artist => artist.name).join(', '),
	// 					albumArt: artwork.large || artwork.medium || artwork.small,
	// 					type: 'audio',
	// 				},
	// 			},
	// 			(err, result) => {
	// 				console.log('playtrack', err, result);
	// 				if (err) {
	// 					return reject(err);
	// 				}
	// 				resolve(result);
	// 			}
	// 		)
	// 	)
	// 		.then(() => {
	// 			if (opts.position) {
	// 				return new Promise((resolve, reject) =>
	// 					device.sonos.seek(Math.round(position / 1000), (err, result) => err ? reject(err) : resolve(result))
	// 				);
	// 			}
	// 		})
	// 		.catch(() => null)
	// 		.then(() => {
	// 			if (opts.startPlaying) {
	// 				return new Promise((resolve, reject) =>
	// 					device.sonos.play((err, result) => err ? reject(err) : resolve(result))
	// 				);
	// 			}
	// 		})
	// 		.then(() => {
	// 			device.speaker.updateState({ track: track, position: opts.position });
	// 			this.realtime(device.deviceData, 'speaker_playing', Boolean(opts.startPlaying));
	// 			callback(null, track);
	// 		})
	// 		.catch(callback);
	// 	// device.sonos.pause(err => {
	// 	// 	if (err) return console.log('flush err') & callback(err);
	// 	//
	// 	// 	device.sonos.queueNext(uri, (err, result) => {
	// 	// 		console.log('play', err, result);
	// 	// 		callback(err, result);
	// 	// 	});
	// 	// });
	// 	// }
	// }
	//
	// _playSpotify(device, trackId, opts, callback) {
	// 	// if (opts.delay) {
	// 	// 	device.sonos.addSpotifyQueue(trackId, (err, result) => {
	// 	// 		console.log('addSpotifyQueue 2', err, result);
	// 	// 		callback(err, result);
	// 	// 	});
	// 	// } else {
	// 	device.sonos.selectQueue(err => {
	// 		if (err) return console.log('selectQueue err') & callback(err);
	// 		device.sonos.flush(err => {
	// 			if (err) return callback(err);
	// 			device.sonos.addSpotifyQueue(trackId, (err, result) => {
	// 				console.log('addSpotifyQueue', err, result);
	// 				if (err) return callback(err);
	// 				if (opts.startPlaying) {
	// 					device.sonos.play(callback);
	// 				} else {
	// 					callback(null, true);
	// 				}
	// 			});
	// 		});
	// 	});
	// 	// }
	// }
	//
	// _playSoundCloud(device, trackId, callback) {
	// 	device.sonos.flush(err => {
	// 		if (err) return callback(err);
	// 		device.sonos.play({ uri: 'x-sonos-http:track%3a232202756.mp3?sid=160&flags=8224&sn=10' }, (err, result) => {
	// 			callback(err, result);
	// 			device.sonos.currentTrack(console.log.bind(null, 'TRACK'));
	// 		});
	// 	});
	// }
	//
	// _compareTrack(device, callback) {
	// 	device.sonos.currentTrack((err, track) => {
	// 		if (err) return callback(err);
	// 		if (device.isActiveSpeaker && device.lastTrack) {
	// 			const diffProp = Object.keys(track).find((trackProp) =>
	// 				trackProp !== 'position' && device.lastTrack[trackProp] !== track[trackProp]
	// 			);
	// 			if (diffProp) {
	// 				console.log('Property', diffProp, 'is not equal to lastTrack');
	// 				if (device.lastTrack.strikes > 2) {
	// 					console.log('your out');
	// 					return device.speaker.setInactive(new Error('Track not in sync with Homey'));
	// 				}
	// 				console.log('strike');
	// 				device.lastTrack.strikes = (device.lastTrack.strikes || 0) + 1;
	// 				return;
	// 			}
	// 			device.lastTrack.strikes = 0;
	// 			if (!(track.position === 0 && track.duration - device.lastPos <= 10)) {
	// 				console.log('correct, updating position', track.position * 1000);
	// 				device.speaker.updateState({ position: track.position * 1000 });
	// 				device.sonos.getCurrentState((err, state) => {
	// 					if (err) return callback(err);
	// 					this.realtime(device.deviceData, 'speaker_playing', state === 'playing');
	// 					callback();
	// 				});
	// 			} else {
	// 				callback();
	// 			}
	// 		}
	// 	});
	// }

	// _uninitDevice(deviceData) {
	// 	const device = this._getDevice(deviceData);
	// 	clearInterval(device.pollInterval);
	// 	if (device.speaker) {
	// 		this.unregisterSpeaker(deviceData);
	// 	}
	// 	this.log('_uninitDevice', deviceData);
	// }
	//
	// _getDevice(deviceData) {
	// 	return (deviceData ? this._devices[deviceData.sn] : this._devices[Object.keys(this._devices).shift()]) || new Error('invalid_device');
	// }

	/*
	 Exports
	 */

	onPair(socket) {

		socket
			.on('list_devices', async (data, callback) => {

				Homey.app.restartApi();
				let topologyChangeCallback;
				await Promise.race([
					new Promise(resolve => {
						topologyChangeCallback = resolve;
						this.api.once('topology-change', resolve);
					}),
					new Promise(resolve => setTimeout(resolve, this.listDevicesTimeout))
				]).then(() => {
					this.api.removeListener('topology-change', topologyChangeCallback);
				});

				const devices = (await Promise.all(
					this.api.getPlayers()
						.filter(player =>
							!this.getDevices().some(device => device.getData().sn === player.uuid)
						)
						.map(player => {
							return this.api.actions.info(player)
								.then(info => {
									const deviceData = {
										name: player.roomName,
										data: {
											sn: player.uuid,
										}
									};

									if (icons.indexOf(info.modelNumber) !== -1) {
										deviceData.icon =
											`/models/${info.modelNumber}.svg`
										;
									}

									return deviceData;
								});
						})
				));


				// for (const sn in this._searchResults) {
				// 	const searchResult = this._searchResults[sn];
				//
				// 	const deviceObj = {
				// 		name: searchResult.roomName,
				// 		data: {
				// 			sn: searchResult.serialNum,
				// 		},
				// 	};
				//
				// 	if (icons.indexOf(searchResult.modelNumber) > -1) {
				// 		deviceObj.icon =
				// 			`/models/${searchResult.modelNumber}.svg`
				// 		;
				// 	}
				//
				// 	devices.push(deviceObj);
				// }

				callback(null, devices);

			});

	}

	// _onAdded(deviceData) {
	// 	this.log('_onAdded', deviceData);
	// 	this._initDevice(deviceData);
	// }
	//
	// _onDeleted(deviceData) {
	// 	this.log('_onDeleted', deviceData);
	// 	this._uninitDevice(deviceData);
	// 	delete this._devices[deviceData.sn];
	// 	if (this._devices.length === 0) {
	// 		Homey.manager('media').requestPlaylistsUpdate();
	// 	}
	// }
	//
	// /*
	//  Capabilities
	//  */
	// _onCapabilitySpeakerPlayingGet(deviceData, callback) {
	// 	this.log('_onCapabilitySpeakerPlayingGet');
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	callback(null, device.state.speaker_playing);
	//
	// }
	//
	// _onCapabilitySpeakerPlayingSet(deviceData, value, callback) {
	// 	this.log('_onCapabilitySpeakerPlayingSet', value);
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	device.sonos.getCurrentState((err, state) => {
	// 		console.log('_onCapabilitySpeakerPlayingSet', 'state', state);
	// 		if (err) return callback(err);
	// 		if (value === true && state !== 'playing' && state !== 'no_media') {
	// 			device.sonos.play((err) => {
	// 				if (err) return callback(err);
	// 				return callback(null, value);
	// 			});
	// 		} else if (value === false && state === 'playing') {
	// 			if (device.nextTrackCallback) {
	// 				device.nextTrackCallback(new Error('setTrack debounced'));
	// 				device.nextTrackCallback = null;
	// 				clearTimeout(device.nextTrackTimeout);
	// 			}
	// 			device.sonos.pause((err) => {
	// 				if (err) return callback(err);
	// 				return callback(null, value);
	// 			});
	// 		} else {
	// 			return callback(null, value);
	// 		}
	// 	});
	// }
	//
	// _onCapabilitySpeakerPrevSet(deviceData, value, callback) {
	// 	this.log('_onCapabilitySpeakerPrevSet', value);
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	device.sonos.previous(callback);
	//
	// }
	//
	// _onCapabilitySpeakerNextSet(deviceData, value, callback) {
	// 	this.log('_onCapabilitySpeakerNextSet', value);
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	device.sonos.next(callback);
	//
	// }
	//
	// _onCapabilityVolumeSetGet(deviceData, callback) {
	// 	this.log('_onCapabilityVolumeSetGet');
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	device._sonos.getVolume((err, volume) => {
	// 		if (err) return callback(err);
	// 		return callback(null, volume / 100);
	// 	});
	//
	// }
	//
	// _onCapabilityVolumeSetSet(deviceData, value, callback) {
	// 	this.log('_onCapabilityVolumeSetSet', value);
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	const groupConnections = device.group.filter(conn => conn !== device._sonos);
	// 	Promise.all(
	// 		[
	// 			new Promise((resolve, reject) => device._sonos.getVolume((err, res) => err ? reject(err) : resolve(res))),
	// 		].concat(groupConnections.map(conn =>
	// 				new Promise((resolve, reject) => conn.getVolume((err, res) => err ? reject(err) : resolve(res)))
	// 			)
	// 		)
	// 	).then(result => {
	// 		const curr = result[0];
	// 		const diff = value * 100 - curr;
	//
	// 		return Promise.all([
	// 			new Promise((resolve, reject) =>
	// 				device._sonos.setVolume(value * 100, (err, res) => {
	// 					if (err) return callback(err);
	// 					device.sonos.setMuted(false, () => this.realtime(deviceData, 'volume_mute', false));
	//
	// 					return callback(null, res);
	// 				})
	// 			),
	// 		].concat(groupConnections.map((conn, i) =>
	// 				new Promise((resolve, reject) =>
	// 					conn.setVolume(
	// 						Math.round(result[i + 1] + diff * Math.max(Math.max(result[i + 1], 1) / Math.max(curr, 1), 0.25)),
	// 						(err, res) => err ? reject(err) : resolve(res)
	// 					)
	// 				)
	// 			)
	// 		)).then(() => callback(null, value));
	// 	}).catch(callback);
	// }
	//
	// _onCapabilityVolumeMuteGet(deviceData, callback) {
	// 	this.log('_onCapabilityVolumeMuteGet');
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	device._sonos.getMuted((err, muted) => {
	// 		if (err) return callback(err);
	// 		return callback(null, muted);
	// 	});
	//
	// }
	//
	// _onCapabilityVolumeMuteSet(deviceData, value, callback) {
	// 	this.log('_onCapabilityVolumeMuteSet', value);
	//
	// 	const device = this._getDevice(deviceData);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	device._sonos.setMuted(value, (err) => {
	// 		if (err) return callback(err);
	//
	// 		return callback(null, value);
	// 	});
	//
	// }
	//
	// _onFlowConditionPlaybackState(callback, args) {
	// 	this.log('_onFlowConditionPlaybackState', args);
	//
	// 	const device = this._getDevice(args.device);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	console.log('get state');
	// 	device.sonos.getCurrentState((err, state) => {
	// 		console.log('got state', err, state);
	// 		if (err) return callback(err);
	// 		callback(null, args.state === state);
	// 	});
	// }
	//
	// _onFlowActionGroupVolumeMute(callback, args) {
	// 	this.log('_onFlowActionGroupVolumeMute', args);
	//
	// 	const device = this._getDevice(args.device);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	return Promise.all(
	// 		device.group.map((conn) =>
	// 			new Promise((resolve, reject) =>
	// 				conn.setMuted(true, err => err ? reject(err) : resolve())
	// 			)
	// 		)
	// 	).then(() => callback(null, true)).catch(callback);
	// }
	//
	// _onFlowActionGroupVolumeUnmute(callback, args) {
	// 	this.log('_onFlowActionGroupVolumeMute', args);
	//
	// 	const device = this._getDevice(args.device);
	// 	if (device instanceof Error) return callback(device);
	//
	// 	return Promise.all(
	// 		device.group.map((conn) =>
	// 			new Promise((resolve, reject) =>
	// 				conn.setMuted(false, err => err ? reject(err) : resolve())
	// 			)
	// 		)
	// 	).then(() => callback(null, true)).catch(callback);
	// }
	//
	// static codecToProtocol(codec) {
	// 	switch (codec) {
	// 		case 'homey:codec:mp3':
	// 			return 'http-get:*:audio/mpeg:*';
	// 		default:
	// 			return null;
	// 	}
	// }
};
