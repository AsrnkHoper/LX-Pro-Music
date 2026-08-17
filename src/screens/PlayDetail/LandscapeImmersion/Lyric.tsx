import LyricView from '../components/LyricView'

export default () => (
  <LyricView
    fontSizeKey="playDetail.landscapeImmersion.style.lrcFontSize"
    variant="landscape"
    useContentPadding
    viewPosition={0.5}
    lineHeightRatio={1.5}
    paddingHorizontal={40}
    paddingRight={20}
  />
)
