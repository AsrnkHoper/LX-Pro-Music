import { memo, useMemo } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { SvgIcon } from '@/components/common/SvgIcon'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS, LIST_IDS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import React, { useState, useRef, useCallback } from 'react'
import { Animated, Easing } from 'react-native'
import { useMyList } from '@/store/list/hook'
import { setActiveList, updateUserListPosition } from '@/core/list'
import { navigations } from "@/navigation"
import commonState from '@/store/common/state'

const CollapsibleMyListItem = () => {
  const t = useI18n();
  const theme = useTheme();
  const allList = useMyList();
  const [isExpanded, setExpanded] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  const contentHeight = useRef(0);

  const toggleCollapse = () => {
    const toValue = isExpanded ? 0 : 1;
    Animated.timing(animation, {
      toValue,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
    setExpanded(!isExpanded);
  };

  const handleSelect = useCallback((listId: string) => {
    setNavActiveId('nav_love');
    setActiveList(listId);
    global.app_event.changeMenuVisible(false);
  }, []);

  const handleMoveUp = useCallback((listId: string) => {
    const userLists = allList.filter(l => l.id !== LIST_IDS.DEFAULT && l.id !== LIST_IDS.LOVE);
    const currentIndex = userLists.findIndex(l => l.id === listId);
    if (currentIndex <= 0) return;
    
    const prevList = userLists[currentIndex - 1];
    if (!prevList) return;

    updateUserListPosition(currentIndex - 1, [listId]);
  }, [allList]);

  const handleMoveDown = useCallback((listId: string) => {
    const userLists = allList.filter(l => l.id !== LIST_IDS.DEFAULT && l.id !== LIST_IDS.LOVE);
    const currentIndex = userLists.findIndex(l => l.id === listId);
    if (currentIndex < 0 || currentIndex >= userLists.length - 1) return;

    updateUserListPosition(currentIndex + 1, [listId]);
  }, [allList]);

  const animatedHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight.current],
  });

  const animatedOpacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View>
      <TouchableOpacity style={styles.menuItem} onPress={toggleCollapse}>
        <View style={styles.iconContent}>
          <Icon name="love" size={20} color={theme['c-font-label']} />
        </View>
        <Text style={styles.text}>{t('nav_love')}</Text>
      </TouchableOpacity>

      <Animated.View style={{ height: animatedHeight, opacity: animatedOpacity, overflow: 'hidden' }}>
        <View
          onLayout={(event) => {
            contentHeight.current = event.nativeEvent.layout.height;
          }}
          style={{ position: 'absolute', width: '100%' }}
        >
          {allList.map((list) => {
            const isFixed = list.id === LIST_IDS.DEFAULT || list.id === LIST_IDS.LOVE;
            const userLists = allList.filter(l => l.id !== LIST_IDS.DEFAULT && l.id !== LIST_IDS.LOVE);
            const userListIndex = userLists.findIndex(l => l.id === list.id);
            const isFirst = userListIndex === 0;
            const isLast = userListIndex === userLists.length - 1;

            return (
              <View key={list.id} style={styles.subMenuItemContainer}>
                <TouchableOpacity
                  style={styles.subMenuItem}
                  onPress={() => handleSelect(list.id)}
                >
                  <Text size={14} color={theme['c-font-label']} numberOfLines={1}>
                    {list.name}
                  </Text>
                </TouchableOpacity>

                {!isFixed && (
                  <View style={styles.subMenuControls}>
                    <TouchableOpacity
                      style={[styles.moveBtn, isFirst && styles.moveBtnDisabled]}
                      onPress={() => handleMoveUp(list.id)}
                      disabled={isFirst}
                    >
                      <Text size={16} color={isFirst ? theme['c-font-label'] : theme['c-font']} style={{ fontWeight: 'bold' }}>
                        ↑
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.moveBtn, isLast && styles.moveBtnDisabled]}
                      onPress={() => handleMoveDown(list.id)}
                      disabled={isLast}
                    >
                      <Text size={16} color={isLast ? theme['c-font-label'] : theme['c-font']} style={{ fontWeight: 'bold' }}>
                        ↓
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
};
const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 16,
  },
  menus: {
    flex: 1,
  },
  subMenuItem: {
    paddingVertical: 12,
    paddingLeft: 55,
    paddingRight: 10,
    flex: 1,
  },
  subMenuItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subMenuControls: {
    flexDirection: 'row',
    paddingRight: 10,
  },
  moveBtn: {
    padding: 6,
  },
  moveBtnDisabled: {
    opacity: 0.3,
  },
  collapsibleMenuItemText: {
    flex: 1,
    paddingLeft: 20,
  },
  list: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 25,
    paddingRight: 25,
    alignItems: 'center',
  },
  iconContent: {
    width: 24,
    alignItems: 'center',
  },
  text: {
    paddingLeft: 20,
  },
  footer: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  footerBtn: {
    padding: 10,
  },
})

const Header = () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View
      style={{
        paddingTop: statusBarHeight,
        backgroundColor: theme['c-primary-light-700-alpha-500'],
      }}
    >
      <View style={styles.header}>
        <Icon name="logo" color={theme['c-primary-dark-100-alpha-300']} size={28} />
        <Text style={styles.headerText} size={28} color={theme['c-primary-dark-100-alpha-300']}>
          LX-Pro Music
        </Text>
      </View>
    </View>
  )
}

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

const renderIcon = (icon: string, size: number, color: string) => {
  if (icon.startsWith('svg:')) {
    return <SvgIcon name={icon.slice(4)} size={size} color={color} />
  }
  return <Icon name={icon} size={size} color={color} />
}

const MenuItem = ({
  id,
  icon,
  onPress,
}: {
  id: IdType
  icon: string
  onPress: (id: IdType) => void
}) => {
  const t = useI18n()
  const activeId = useNavActiveId()
  const theme = useTheme()

  return activeId == id ? (
    <View style={{ ...styles.menuItem, backgroundColor: theme['c-primary-background-hover'] }}>
      <View style={styles.iconContent}>
        {renderIcon(icon, 20, theme['c-primary-font-active'])}
      </View>
      <Text style={styles.text} color={theme['c-primary-font']}>
        {t(id)}
      </Text>
    </View>
  ) : (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={() => {
        onPress(id)
      }}
    >
      <View style={styles.iconContent}>
        {renderIcon(icon, 20, theme['c-font-label'])}
      </View>
      <Text style={styles.text}>{t(id)}</Text>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const theme = useTheme()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')
  const navStatus = useSettingValue('common.navStatus');
  const navOrder = useSettingValue('common.navOrder');
  const isShowMyListSubMenu = useSettingValue('list.isShowMyListSubMenu');

  const handlePress = (id: IdType) => {
    switch (id) {
      case 'nav_exit':
        void confirmDialog({
          message: global.i18n.t('exit_app_tip'),
          confirmButtonText: global.i18n.t('list_remove_tip_button'),
        }).then((isExit) => {
          if (!isExit) return
          exitApp('Exit Btn')
        })
        return
      case 'back_home':
        backHome()
        return
    }
    global.app_event.changeMenuVisible(false)
    setNavActiveId(id as any)
  }

  const handleDownloadPress = () => {
    global.app_event.changeMenuVisible(false);
    navigations.pushDownloadManagerScreen(commonState.componentIds[commonState.componentIds.length - 1]?.id!);
  };
  const filteredNavMenus = useMemo(() => {
    if (!navOrder) return NAV_MENUS.filter(
      menu => menu.id !== 'nav_play_history' && (menu.id === 'nav_setting' || (navStatus[menu.id] ?? true))
    );

    return navOrder
      .filter(id => id !== 'nav_play_history')
      .map(id => NAV_MENUS.find(menu => menu.id === id))
      .filter((menu): menu is typeof NAV_MENUS[number] => menu !== undefined && (menu.id === 'nav_setting' || (navStatus[menu.id] ?? true)));
  }, [navStatus, navOrder]);

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      <Header />
      <ScrollView style={styles.menus}>
        <View style={styles.list}>
          {filteredNavMenus.map((menu) => {
            if (menu.id === 'nav_love') {
              return isShowMyListSubMenu
                ? <CollapsibleMyListItem key={menu.id} />
                : <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} />;
            }
            return <MenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} />;
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={handleDownloadPress}>
          <Icon name="download-2" size={22} color={theme['c-font-label']} />
        </TouchableOpacity>
      </View>

      {global.lx.isCarMode && showBackBtn ? <MenuItem id="back_home" icon="home" onPress={handlePress} /> : null}
      {global.lx.isCarMode && showExitBtn ? <MenuItem id="nav_exit" icon="exit2" onPress={handlePress} /> : null}
    </View>
  )
})