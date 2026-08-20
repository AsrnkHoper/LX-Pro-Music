import { Linking } from 'react-native'
import { errorDialog } from './utils'
import { handleMusicAction } from './musicAction'
import { handlePlayerAction, type PlayerAction } from './playerAction'
import { handleSonglistAction } from './songlistAction'
import { extname, stat } from '@/utils/fs'
import { handleFileMusicAction, handleFileJSAction, handleFileLXMCAction, handleFileMIDIAction } from './fileAction'

const handleLinkAction = async (link: string) => {
  // console.log(link)
  const [url, search] = link.split('?')
  const [type, action, ...paths] = url.replace('lxmusic://', '').split('/')
  const params: {
    paths: string[]
    data?: string
    [key: string]: any
  } = {
    paths: [],
  }
  if (search) {
    for (const param of search.split('&')) {
      const [key, value] = param.split('=')
      params[key] = value
    }
    if (params.data) params.data = JSON.parse(decodeURIComponent(params.data))
  }
  params.paths = paths.map((p) => decodeURIComponent(p))
  console.log(params)
  switch (type) {
    case 'music':
      await handleMusicAction(action, params)
      break
    case 'songlist':
      await handleSonglistAction(action, params)
      break
    case 'player':
      await handlePlayerAction(action as PlayerAction)
      break
    // default: throw new Error('Unknown type: ' + type)
  }
}

const handleFileAction = async (link: string) => {
  const file = await stat(link)
  const ext = extname(file.name).toLowerCase()
  // console.log(file)
  switch (ext) {
    case 'json':
    case 'lxmc':
      await handleFileLXMCAction(file)
      break
    case 'js':
      await handleFileJSAction(file)
      break
    case 'mid':
    case 'midi':
    case 'kar':
      await handleFileMIDIAction(file)
      break
    case 'ogg':
    case 'flac':
    case 'wav':
    case 'mp3':
      await handleFileMusicAction(file)
      break
    default:
      if (/\baudio\//.test(file.mimeType ?? '') || /\bmidi\b/i.test(file.mimeType ?? ''))
        await handleFileMusicAction(file)
      else throw new Error('Unknown file type')
      break
  }
}

// const handleHttpAction = async(link: string) => {
// }

const runLinkAction = async (link: string) => {
  if (link.startsWith('lxmusic://')) {
    try {
      await handleLinkAction(link)
    } catch (err: any) {
      errorDialog(err.message)
      // focusWindow()
    }
  } else if (link.startsWith('file://') || link.startsWith('content://')) {
    try {
      await handleFileAction(link)
    } catch (err: any) {
      errorDialog(err.message)
      // focusWindow()
    }
  }
  //  else if (/^https?:\/\//.test(link)) {
  //   try {
  //     await handleHttpAction(link)
  //   } catch (err: any) {
  //     errorDialog(err.message)
  //     // focusWindow()
  //   }
  // }
}

export const initDeeplink = async () => {
  Linking.addEventListener('url', ({ url }) => {
    void runLinkAction(url)
    console.log('deeplink', url)
  })
  const initialUrl = await Linking.getInitialURL()
  if (initialUrl == null) return
  console.log('deeplink', initialUrl)
  void runLinkAction(initialUrl)
}
