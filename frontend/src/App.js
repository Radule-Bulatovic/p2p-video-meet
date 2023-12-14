import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import AssignmentIcon from "@material-ui/icons/Assignment";
import PhoneIcon from "@material-ui/icons/Phone";
import React, { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Peer from "simple-peer";
import io from "socket.io-client";
import {
  CloudDownload,
  FiberManualRecord,
} from "@material-ui/icons";
import { Box, Card } from "@material-ui/core";

const socket = io.connect("http://localhost:5000");
function App() {
  const [me, setMe] = useState("");
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();  

  const recordingBlobs = useRef([]);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        console.log("new media recorder");
        setMediaRecorder(new MediaRecorder(stream));
        setStream(stream);
        myVideo.current.srcObject = stream;
      });

    socket.on("me", (id) => {
      setMe(id);
    });

    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
    });
  }, []);

  const callUser = (id) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });
    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name: name,
      });
    });
    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream;
    });
    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });
    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });
    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream;
      console.log("peer.on(stream)", stream);
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    connectionRef.current.destroy();
  };

  return (
    <Box position={"relative"} width="100vw" height="100vh" bgcolor={"black"} zIndex={-2}>
      <div className="video-container">
        <div className="video">
          {stream && (
            <video
              playsInline
              muted
              ref={myVideo}
              autoPlay
              style={{ width: "300px" }}
            />
          )}
        </div>
        <div className="video">
          {callAccepted && !callEnded ? (
            <video
              playsInline
              ref={userVideo}
              autoPlay
              style={{ width: "100vw", height: "100vh", objectFit: "cover", position: "absolute", top: 0, left: 0, zIndex: -1 }}
            />
          ) : null}
        </div>
      </div>
      <Card
        style={{
          display: "flex",
          flexDirection: "column",
          width: "10rem",
          padding: "2rem",
          backgroundColor: "rgba(255,255,255,0.8)",
          position: "absolute",
          right: "5rem",
          top: "50%",
          translate: "0 -50%",
        }}
      >
        <TextField
          id="filled-basic"
          label="Name"
          variant="filled"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginBottom: "20px" }}
        />
        <CopyToClipboard text={me} style={{ marginBottom: "2rem" }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AssignmentIcon fontSize="large" />}
          >
            Copy ID
          </Button>
        </CopyToClipboard>

        <TextField
          id="filled-basic"
          label="ID to call"
          variant="filled"
          value={idToCall}
          onChange={(e) => setIdToCall(e.target.value)}
        />
        <div className="call-button">
          {callAccepted && !callEnded ? (
            <Button variant="contained" color="secondary" onClick={leaveCall}>
              End Call
            </Button>
          ) : (
            <IconButton
              color="primary"
              aria-label="call"
              onClick={() => callUser(idToCall)}
            >
              <PhoneIcon fontSize="large" />
            </IconButton>
          )}
          {idToCall}
        </div>
      </Card>
      <div>
        {receivingCall && !callAccepted ? (
          <div className="caller">
            <h1>{name} is calling...</h1>
            <Button variant="contained" color="primary" onClick={answerCall}>
              Answer
            </Button>
          </div>
        ) : null}
      </div>

      <Box
        style={{
          position: "absolute",
          bottom: "1rem",
          left: "50%",
          translate: "-50% 0",
          display: "flex",
          gap: "1rem",
        }}
      >
        <IconButton
          style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
          onClick={() => {
            console.log("STOPPED RECORDING");
            if (mediaRecorder) {
              mediaRecorder.addEventListener("stop", () => {
                // This event listener will handle the data and initiate the download
                mediaRecorder.stream
                  .getTracks()
                  .forEach((track) => track.stop());
              });

              mediaRecorder.stop();
            }
          }}
        >
          <CloudDownload />
        </IconButton>
        <IconButton
          style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
          onClick={() => {
            console.log("STARTED RECORDING");
            const recorder = new MediaRecorder(stream);

            recorder.addEventListener("dataavailable", (event) => {
              console.log("dataavailable");
              if (event.data.size > 0) {
                socket.emit("recordedVideoChunk", { data: event.data });
              }
            });

            setMediaRecorder(recorder);
            recorder.start(1000);
          }}
        >
          <FiberManualRecord color="error" />
        </IconButton>

        <IconButton
          style={{ backgroundColor: "rgba(255,255,255,0.6)" }}
          onClick={() => {
            socket.close()
          }}
        >
          hang up
        </IconButton>
      </Box>
    </Box>
  );
}

export default App;
