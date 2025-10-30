/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useRef, useState, useCallback} from 'react'
import c from 'clsx'
import {
  snapPhoto,
  setMode,
  deletePhoto,
  makeGif,
  hideGif,
  setCustomPrompt
} from '../lib/actions'
import useStore from '../lib/store'
import imageData from '../lib/imageData'
import modes from '../lib/modes'

const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
const modeKeys = Object.keys(modes)

export default function App() {
  const photos = useStore.use.photos()
  const customPrompt = useStore.use.customPrompt()
  const activeMode = useStore.use.activeMode()
  const gifInProgress = useStore.use.gifInProgress()
  const gifUrl = useStore.use.gifUrl()
  const [videoActive, setVideoActive] = useState(false)
  const [didInitVideo, setDidInitVideo] = useState(false)
  const [focusedId, setFocusedId] = useState(null)
  const [didJustSnap, setDidJustSnap] = useState(false)
  const [hoveredMode, setHoveredMode] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({top: 0, left: 0})
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)

  const startVideo = async () => {
    setDidInitVideo(true)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {width: {ideal: 1920}, height: {ideal: 1080}},
      audio: false,
      facingMode: {ideal: 'user'}
    })
    setVideoActive(true)
    videoRef.current.srcObject = stream

    const {width, height} = stream.getVideoTracks()[0].getSettings()
    const squareSize = Math.min(width, height)
    canvas.width = squareSize
    canvas.height = squareSize
  }

  const takePhoto = () => {
    const video = videoRef.current
    const {videoWidth, videoHeight} = video
    const squareSize = canvas.width
    const sourceSize = Math.min(videoWidth, videoHeight)
    const sourceX = (videoWidth - sourceSize) / 2
    const sourceY = (videoHeight - sourceSize) / 2

    ctx.clearRect(0, 0, squareSize, squareSize)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(
      video,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      -squareSize,
      0,
      squareSize,
      squareSize
    )
    snapPhoto(canvas.toDataURL('image/jpeg'))
    setDidJustSnap(true)
    setTimeout(() => setDidJustSnap(false), 1000)
  }

  const handleFileUpload = event => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const {width, height} = img
        const squareSize = Math.min(width, height)
        canvas.width = squareSize
        canvas.height = squareSize

        const sourceX = (width - squareSize) / 2
        const sourceY = (height - squareSize) / 2

        ctx.clearRect(0, 0, squareSize, squareSize)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          squareSize,
          squareSize,
          0,
          0,
          squareSize,
          squareSize
        )
        snapPhoto(canvas.toDataURL('image/jpeg'))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
    event.target.value = null
  }

  const downloadImage = () => {
    const a = document.createElement('a')
    a.href = gifUrl || imageData.outputs[focusedId]
    a.download = `goolakh.${gifUrl ? 'gif' : 'jpg'}`
    a.click()
  }

  const handleModeHover = useCallback((modeInfo, event) => {
    if (!modeInfo) {
      setHoveredMode(null)
      return
    }

    setHoveredMode(modeInfo)

    const rect = event.currentTarget.getBoundingClientRect()
    const tooltipTop = rect.top
    const tooltipLeft = rect.left + rect.width / 2

    setTooltipPosition({
      top: tooltipTop,
      left: tooltipLeft
    })
  }, [])

  return (
    <main>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        style={{display: 'none'}}
        accept="image/*"
      />
      <div className="results">
        <h2>گالری</h2>
        <ul>
          {photos.length
            ? photos.map(({id, mode, isBusy}) => (
                <li className={c({isBusy})} key={id}>
                  <button
                    className="circleBtn deleteBtn"
                    onClick={() => {
                      deletePhoto(id)
                      if (focusedId === id) {
                        setFocusedId(null)
                      }
                    }}
                  >
                    <span className="icon">delete</span>
                  </button>
                  <button
                    className="photo"
                    onClick={() => {
                      if (!isBusy) {
                        setFocusedId(id)
                        hideGif()
                      }
                    }}
                  >
                    <img
                      src={
                        isBusy ? imageData.inputs[id] : imageData.outputs[id]
                      }
                      draggable={false}
                    />
                    <p className="emoji">
                      {mode === 'custom' ? '✏️' : modes[mode].emoji}
                    </p>
                  </button>
                </li>
              ))
            : videoActive && (
                <li className="empty" key="empty">
                  <p>
                    <span className="icon">photo_camera</span>
                  </p>
                  برای شروع یک عکس بگیرید.
                </li>
              )}
          {photos.filter(p => !p.isBusy).length > 0 && (
            <button
              className="button makeGif"
              onClick={makeGif}
              disabled={gifInProgress}
            >
              {gifInProgress ? 'یک لحظه…' : 'ساختن GIF!'}
            </button>
          )}
        </ul>
      </div>

      <div
        className="video"
        onClick={() => {
          if (focusedId || gifUrl) {
            hideGif()
            setFocusedId(null)
          }
        }}
      >
        {showCustomPrompt && (
          <div className="customPrompt">
            <button
              className="circleBtn"
              onClick={() => {
                setShowCustomPrompt(false)

                if (customPrompt.trim().length === 0) {
                  setMode(modeKeys[0])
                }
              }}
            >
              <span className="icon">close</span>
            </button>
            <textarea
              type="text"
              placeholder="یک دستور سفارشی وارد کنید"
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowCustomPrompt(false)
                }
              }}
            />
          </div>
        )}
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          disablePictureInPicture="true"
        />
        {didJustSnap && <div className="flash" />}
        {!videoActive && (
          <button className="startButton" onClick={startVideo}>
            <h1>📸 goolakh</h1>
            <p>{didInitVideo ? 'یک لحظه…' : 'برای شروع وب‌کم، هرجا ضربه بزنید'}</p>
          </button>
        )}

        {videoActive && (
          <div className="videoControls">
            <ul className="modeSelector">
              <li
                key="custom"
                onMouseEnter={e =>
                  handleModeHover({key: 'custom', prompt: customPrompt}, e)
                }
                onMouseLeave={() => handleModeHover(null)}
              >
                <button
                  className={c({active: activeMode === 'custom'})}
                  onClick={() => {
                    setMode('custom')
                    setShowCustomPrompt(true)
                  }}
                >
                  <p>سفارشی</p>
                </button>
              </li>
              {Object.entries(modes).map(([key, {name, emoji, prompt}]) => (
                <li
                  key={key}
                  onMouseEnter={e => handleModeHover({key, prompt}, e)}
                  onMouseLeave={() => handleModeHover(null)}
                >
                  <button
                    onClick={() => setMode(key)}
                    className={c({active: key === activeMode})}
                  >
                    <p>{name}</p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mainControls">
              <button
                className="galleryPreview"
                onClick={() => photos.length > 0 && setFocusedId(photos[0].id)}
              >
                {photos.length > 0 && (
                  <img src={imageData.inputs[photos[0].id]} />
                )}
              </button>
              <button onClick={takePhoto} className="shutter" />
              <button
                className="cameraSwitch"
                onClick={() => fileInputRef.current.click()}
              >
                <span className="icon">add_photo_alternate</span>
              </button>
            </div>
          </div>
        )}

        {(focusedId || gifUrl) && (
          <div className="focusedPhoto" onClick={e => e.stopPropagation()}>
            <button
              className="circleBtn"
              onClick={() => {
                hideGif()
                setFocusedId(null)
              }}
            >
              <span className="icon">close</span>
            </button>
            <img
              src={gifUrl || imageData.outputs[focusedId]}
              alt="عکس"
              draggable={false}
            />
            <button className="button downloadButton" onClick={downloadImage}>
              دانلود
            </button>
          </div>
        )}
      </div>

      {hoveredMode && (
        <div
          className={c('tooltip', {isFirst: hoveredMode.key === 'custom'})}
          role="tooltip"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translateX(-50%)'
          }}
        >
          {hoveredMode.key === 'custom' && !hoveredMode.prompt.length ? (
            <p>برای تنظیم دستور سفارشی کلیک کنید</p>
          ) : (
            <>
              <p>"{hoveredMode.prompt}"</p>
              <h4>دستور</h4>
            </>
          )}
        </div>
      )}
    </main>
  )
}