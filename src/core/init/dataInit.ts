// import { getPlayInfo } from '@/utils/data'
// import { log } from '@/utils/log'
import { init as musicSdkInit } from '@/utils/musicSdk'
import { getUserLists, setUserList } from '@/core/list'
import { setNavActiveId } from '../common'
import { getViewPrevState } from '@/utils/data'
import { bootLog } from '@/utils/bootLog'
import { getDislikeInfo, setDislikeInfo } from '@/core/dislikeList'
import { unlink } from '@/utils/fs'
import { TEMP_FILE_PATH } from '@/utils/tools'
// import { play, playList } from '../player/player'
import wyUserApi from '@/utils/musicSdk/wy/user'
import {
  setWyFollowedArtists,
  setWyLikedSongs,
  setWySubscribedAlbums,
  setWySubscribedPlaylists,
  setWyUid
} from '@/store/user/action.ts'
import {getDownloadTasks} from "@/utils/data/download.ts";
import downloadActions from '@/store/download/action';
// const initPrevPlayInfo = async(appSetting: LX.AppSetting) => {
//   const info = await getPlayInfo()
//   global.lx.restorePlayInfo = null
//   if (!info?.listId || info.index < 0) return
//   const list = await getListMusics(info.listId)
//   if (!list[info.index]) return
//   global.lx.restorePlayInfo = info
//   await playList(info.listId, info.index)

//   if (appSetting['player.startupAutoPlay']) setTimeout(play)
// }

const initWyData = async (wy_cookie: string) => {
  try {
    bootLog("Wy data init...")
    const uid = await wyUserApi.getUid(wy_cookie)
    setWyUid(uid)
    await Promise.all([
      wyUserApi.getLikedSongList(uid, wy_cookie).then(ids => {
        setWyLikedSongs(ids)
        bootLog("Wy like list inited.")
      }),
      wyUserApi.getAllSublist().then(artists => {
        setWyFollowedArtists(artists)
        bootLog("Wy followed artists inited.")
      }),
      wyUserApi.getAllSubAlbumList().then(albums => {
        setWySubscribedAlbums(albums)
        bootLog("Wy liked albums inited.")
      }),
      wyUserApi.getUserPlaylists(uid, wy_cookie).then(playlists => {
        setWySubscribedPlaylists(playlists)
        bootLog("Wy subscribed playlists inited.")
      }),
    ])
    bootLog("Wy data inited.")
  } catch (err) {
    bootLog("Wy data init failed: " + str(err))
  }
}

export default async (appSetting: LX.AppSetting) => {
  // await Promise.all([
  //   initUserApi(), // 自定义API
  // ]).catch(err => log.error(err))
  void musicSdkInit() // 初始化音乐sdk
  bootLog('User list init...')
  setUserList(await getUserLists()) // 获取用户列表
  setDislikeInfo(await getDislikeInfo()) // 获取不喜欢列表
  bootLog('User list inited.')


  bootLog('Download tasks init...');
  const savedTasks = await getDownloadTasks();
  downloadActions.setTasks(savedTasks);
  bootLog('Download tasks inited.');

  // 网易云数据延迟加载，减少启动阻塞
  const wy_cookie = appSetting["common.wy_cookie"]
  if (wy_cookie) {
    setTimeout(() => {
      void initWyData(wy_cookie)
    }, 0)
  }

  setNavActiveId((await getViewPrevState()).id)
  void unlink(TEMP_FILE_PATH)
  // await initPrevPlayInfo(appSetting).catch(err => log.error(err)) // 初始化上次的歌曲播放信息
}
