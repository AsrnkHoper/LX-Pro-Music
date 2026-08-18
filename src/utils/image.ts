import RNFetchBlob from 'rn-fetch-blob'
import { getFileExtensionFromUrl } from '@/screens/Home/Views/Mylist/MusicList/download/utils'
import { requestStoragePermission, toast } from '@/utils/tools'

const sanitizeFileName = (name: string) =>
  (name.trim() || 'image').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)

export const saveImageToPictures = async (url: string, name: string = 'image') => {
  const isGranted = await requestStoragePermission()
  if (isGranted !== true) {
    toast('没有存储权限，无法保存图片', 'short')
    return null
  }

  const extension = getFileExtensionFromUrl(url)
  const picBaseDir = RNFetchBlob.fs.dirs.PictureDir || RNFetchBlob.fs.dirs.DownloadDir
  const saveDir = `${picBaseDir}/LX-N-Music`
  const fileName = `${sanitizeFileName(name)}_${Date.now()}.${extension}`
  const filePath = `${saveDir}/${fileName}`

  if (!(await RNFetchBlob.fs.exists(saveDir))) {
    try {
      await RNFetchBlob.fs.mkdir(saveDir)
    } catch (err) {
      // Fallback to the base pictures/download directory below.
    }
  }

  const targetPath = (await RNFetchBlob.fs.exists(saveDir))
    ? filePath
    : `${picBaseDir}/${fileName}`

  await RNFetchBlob.config({ path: targetPath }).fetch('GET', url)
  await RNFetchBlob.fs.scanFile([{ path: targetPath }])
  return targetPath
}

export const saveLocalImageToPictures = async (localPath: string, name: string = 'image') => {
  const isGranted = await requestStoragePermission()
  if (isGranted !== true) {
    toast('没有存储权限，无法保存图片', 'short')
    return null
  }

  const sourcePath = localPath.startsWith('file://') ? localPath.slice(7) : localPath
  const extension = (sourcePath.split('.').pop() || 'jpg').toLowerCase()
  const picBaseDir = RNFetchBlob.fs.dirs.PictureDir || RNFetchBlob.fs.dirs.DownloadDir
  const saveDir = `${picBaseDir}/LX-N-Music`
  const fileName = `${sanitizeFileName(name)}_${Date.now()}.${extension}`
  const filePath = `${saveDir}/${fileName}`

  if (!(await RNFetchBlob.fs.exists(saveDir))) {
    try {
      await RNFetchBlob.fs.mkdir(saveDir)
    } catch (err) {
      // Fallback to the base pictures/download directory below.
    }
  }

  const targetPath = (await RNFetchBlob.fs.exists(saveDir))
    ? filePath
    : `${picBaseDir}/${fileName}`

  try {
    await RNFetchBlob.fs.mv(sourcePath, targetPath)
  } catch (err) {
    // 跨存储卷 mv 可能失败,退化为复制后删除源文件
    await RNFetchBlob.fs.cp(sourcePath, targetPath)
    await RNFetchBlob.fs.unlink(sourcePath).catch(() => {})
  }
  await RNFetchBlob.fs.scanFile([{ path: targetPath }])
  return targetPath
}
