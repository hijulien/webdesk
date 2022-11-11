import React, { useState, useRef, useEffect } from 'react';
import { Button, AutoComplete, message } from 'antd';
import { useEventListener } from 'ahooks';
import Peer from 'peerjs';
import './App.css';

let isPlayerOnFocus = false;

const App = () => {

  console.log("组件执行");

  // let id = "";

  const idList = JSON.parse(localStorage.getItem("idList")) || [];

  let option = [];

  const [data, setData] = useState({
    peer: {},
    dataChan: null,
    mediaChan: null
  })

  const [options, setOptions] = useState(idList.map((v) => {
    return {
      value: v,
      label: v
    }
  }));

  const player = useRef();

  const tools = useRef();

  const toolsShow = () => {
    tools.current.style.height = "200px";
  }

  const mediaCall = (id) => {
    const createEmptyAudioTrack = () => {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const dst = oscillator.connect(ctx.createMediaStreamDestination());
      oscillator.start();
      const track = dst.stream.getAudioTracks()[0];
      return Object.assign(track, { enabled: false });
    };

    const createEmptyVideoTrack = ({ width, height }) => {
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      canvas.getContext('2d').fillRect(0, 0, width, height);

      const stream = canvas.captureStream();
      const track = stream.getVideoTracks()[0];

      return Object.assign(track, { enabled: false });
    };

    const audioTrack = createEmptyAudioTrack();
    const videoTrack = createEmptyVideoTrack({ width: 640, height: 480 });
    const mediaStream = new MediaStream([audioTrack, videoTrack]);

    new Promise((resolve) => {
      resolve(mediaStream)
    }).then(localStream => {
      const mediaConn = data.peer.call(id, localStream);
      const dataConn = data.peer.connect(id);
      mediaConn.on("close", () => console.log("媒体连接被挂断"))
      dataConn.on('close', () => console.log("数据连接被挂断"))
      mediaConn.on('stream', (remoteStream) => {
        player.current.srcObject = remoteStream;
      });
      setData({
        ...data,
        mediaChan: mediaConn,
        dataChan: dataConn
      })
    })
      .catch(err => {
        console.log("call", err);
      });
  }

  const hangUp = () => {
    console.log("挂断");
  }

  const onSelect = (value) => {
    console.log("onSelect");
    if (data.peer._id && !idList.includes(value)) {
      if (idList.length < 5) {
        idList.unshift(value);
        console.log("length < 5", idList);
        localStorage.setItem("idList", JSON.stringify(idList));
      } else {
        idList.pop(value);
        idList.unshift(value);
        console.log("length >= 5", idList);
        localStorage.setItem("idList", JSON.stringify(idList));
      }
    }
    mediaCall(value)
  }

  const onSearch = (searchText) => {
    if (!option.some((v) => {
      return v.value == searchText
    })) {
      setOptions(
        !searchText ? [] : [
          {
            value: searchText,
            label: searchText
          },
          ...option
        ],
      );
    }
  };

  const clickEvent = (e) => {
    tools.current.style.height = 0;
    if (data.dataChan && data.mediaChan) {
      data.dataChan.send({
        type: "leftClick",
        X: (e.nativeEvent.offsetX / player.current.offsetWidth).toFixed(5),
        Y: (e.nativeEvent.offsetY / player.current.offsetHeight).toFixed(5)
      })
    }
  }

  const rightClick = (e) => {
    if (data.dataChan && data.mediaChan) {
      data.dataChan.send({
        type: "rightClick",
        X: (e.nativeEvent.offsetX / player.current.offsetWidth).toFixed(5),
        Y: (e.nativeEvent.offsetY / player.current.offsetHeight).toFixed(5)
      })
    }
    e.preventDefault()
  }

  const wheelEvent = (e) => {
    if (data.dataChan && data.mediaChan) {
      if (e.deltaY > 0 || e.datail > 0) {
        data.dataChan.send({
          type: "downWheel",
        })
      } else {
        data.dataChan.send({
          type: "upWheel",
        })
      }
    }
  }

  const mouseMove = (e) => {
    throttle(e)
  }

  const throttle = ((e) => {
    let last = 0
    return (e, wait = 100) => {
      let now = +new Date()
      if (data.dataChan && data.mediaChan && now - last > wait) {
        data.dataChan.send({
          type: "mouseMove",
          X: (e.nativeEvent.offsetX / player.current.offsetWidth).toFixed(5),
          Y: (e.nativeEvent.offsetY / player.current.offsetHeight).toFixed(5)
        })
        last = now
      }
    }
  })()

  var patt = /^[a-z]{1}$/i;

  //阻止快捷键
  const keyDown = (e) => {
    if (e.keyCode === 112 || (e.keyCode === 114) || (e.keyCode === 116)
      // || (e.keyCode == 123) 
      || (e.ctrlKey && (e.keyCode === 49)) || (e.ctrlKey && (e.keyCode === 50))
      || (e.ctrlKey && (e.keyCode === 50)) || (e.ctrlKey && (e.keyCode === 51))
      || (e.ctrlKey && (e.keyCode === 52)) || (e.ctrlKey && (e.keyCode === 53))
      || (e.ctrlKey && (e.keyCode === 54)) || (e.ctrlKey && (e.keyCode === 55))
      || (e.ctrlKey && (e.keyCode === 56))) {
      e.preventDefault()
      e.returnValue = false;
      console.log("阻止成功", e);
    }
  }
  document.onkeydown = keyDown;

  const clip = () => {
    console.log("chuagnshu");
    data.dataChan.send({
      type: "key",
      value: "C",
      ctrlKey: true,
      shiftKey: false
    })
  }

  useEventListener('keydown', (e) => {
    if (isPlayerOnFocus && data.dataChan && data.mediaChan) {
      switch (true) {
        //匹配字母
        case (patt.test(e.key)):
          if (!(e.key === "v" && e.ctrlKey)) {
            data.dataChan.send({
              type: "key",
              value: e.key.toUpperCase(),
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey
            })
          } else {
            //剪切板同步
            //需获取权限
            navigator.clipboard.readText().then(text => {
              data.dataChan.send({
                type: "key",
                value: e.key.toUpperCase(),
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                clipboardText: text
              })
            })
          }
          break;

        //匹配数字
        case e.code.substring(0, 5) === "Digit":
          console.log("Num" + e.code.substring(e.code.length - 1, 1));
          data.dataChan.send({
            type: "key",
            value: "Num" + e.code.substring(e.code.length - 1, 1),
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey
          })
          break;

        case e.code.substring(0, 6) === "Numpad":
          data.dataChan.send({
            type: "key",
            value: "NumPad" + e.code.substring(e.code.length - 1, 1),
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey
          })
          break;

        //匹配方向键
        case e.key.substring(0, 5) === "Arrow":
          data.dataChan.send({
            type: "key",
            value: e.key.slice(5),
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey
          })
          break;

        case (e.code === "Minus" || e.code === "Equal" || e.code === "Backslash" || e.code === "Semicolon" || e.code === "Quote" || e.code === "Comma" || e.code === "Period" || e.key === "Slash" || e.code === "Space"):
          data.dataChan.send({
            type: "key",
            value: e.code,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey
          })
          break;

        case e.code === "Backquote":
          data.dataChan.send({
            type: "key",
            value: "Grave",
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey
          })
          break;

        default:
          data.dataChan.send({
            type: "key",
            value: e.key,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey
          })
          break;
      }
    }
  });

  useEffect(() => {
    const peer = new Peer('', {
      host: '124.222.249.224',
      port: '9000',
      path: '/myapp'
    });

    peer.on('open', (id) => {
      console.log("opened");
      setData(data => {
        return {
          ...data,
          peer: peer
        }
      });
    });

    peer.on('connection', (conn) => {
      console.log("connectioned");
      conn.on('data', (msg) => {
        console.log("on connection", msg);
      });
    });

    peer.on('call', (call) => {
      console.log("on calle");
      navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "never"
        },
        audio: false
      })
        .then(localStream => {
          call.answer(localStream);
          call.on('stream', (remoteStream) => {
            player.current.srcObject = remoteStream;
          });
        })
    });

    peer.on('close', () => console.log("peer on close"))

    peer.on("error", err => {
      message.error(err);
      console.log("peer on error", err.type);
    })
  }, [])

  return (
    <div className='box'>
      <video
        height={"100%"}
        autoPlay
        playsInline
        ref={player}
        onClick={clickEvent}
        onContextMenu={rightClick}
        onWheel={wheelEvent}
        onMouseMove={mouseMove}
        onMouseOver={() => isPlayerOnFocus = true}
        onMouseOut={() => isPlayerOnFocus = false}
      />

      {
        data.peer._id
          ?
          <>
            <div className='tools-switch' onClick={toolsShow}></div>
            <div
              className={'tools'}
              ref={tools}
            >
              <AutoComplete
                style={{
                  width: '170px',
                }}
                placeholder="ID"
                // onChange={(v) => id = v}
                onSearch={onSearch}
                onSelect={onSelect}
                options={options}
                filterOption={(input, options) =>
                  (options?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
              <div className='tools-buttons'>
                <Button type="primary" onClick={mediaCall}>连接</Button>
                <Button type="primary" onClick={hangUp}>断开</Button>
              </div>
            </div>
            <div className='sidebar'>
              <h3>ID:{data.dataChan?.peer}</h3>
              {/* <h3 onClick={clip}>clipboard</h3> */}
            </div>
          </>
          :
          <div className='loading'>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
      }
    </div>
  );
}

export default App;