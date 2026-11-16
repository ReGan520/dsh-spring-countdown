/**
 * Client half of dsh-spring-countdown.
 *
 * 往左侧栏底部（设置按钮上方）的 `sidebar.footer.action` 席位注册一个
 * 「倒计时」入口，点开是每秒跳动的过年倒计时面板。
 *
 * 这一半运行在 DSH 的浏览器运行时里，模块以 ModuleLoader 形式交付，
 * 只能通过 factory 的 require 取宿主提供的外部模块（react / react-dom）。
 * 日期口径与宿主端 ../lunar.js 相同；两者的一致性由 test/consistency 校验。
 */
window.__ModuleLoader__.load({
  id: 'dsh-spring-countdown',
  factory: (require) => {
    const React = require('react')
    let ReactDOM = null
    try {
      ReactDOM = require('react-dom')
    } catch (error) {
      ReactDOM = null
    }
    const h = React.createElement

    const DAY = 86400000
    const SPRING_TABLE = {
      2000: '2000-02-05', 2001: '2001-01-24', 2002: '2002-02-12', 2003: '2003-02-01',
      2004: '2004-01-22', 2005: '2005-02-09', 2006: '2006-01-29', 2007: '2007-02-18',
      2008: '2008-02-07', 2009: '2009-01-26', 2010: '2010-02-14', 2011: '2011-02-03',
      2012: '2012-01-23', 2013: '2013-02-10', 2014: '2014-01-31', 2015: '2015-02-19',
      2016: '2016-02-08', 2017: '2017-01-28', 2018: '2018-02-16', 2019: '2019-02-05',
      2020: '2020-01-25', 2021: '2021-02-12', 2022: '2022-02-01', 2023: '2023-01-22',
      2024: '2024-02-10', 2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06',
      2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03', 2031: '2031-01-23',
      2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19', 2035: '2035-02-08',
      2036: '2036-01-28', 2037: '2037-02-15', 2038: '2038-02-04', 2039: '2039-01-24',
      2040: '2040-02-12', 2041: '2041-02-01', 2042: '2042-01-22', 2043: '2043-02-10',
      2044: '2044-01-30', 2045: '2045-02-17', 2046: '2046-02-06', 2047: '2047-01-26',
      2048: '2048-02-14', 2049: '2049-02-02', 2050: '2050-01-23',
    }
    const HOLIDAY_TABLE = {
      2027: { start: '2027-02-05', end: '2027-02-13', days: 9, source: '国办发明电〔2026〕10号' },
    }
    const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
    const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    const ZODIACS = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
    const CN_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

    const RED = '#C93A2B'
    const RED_DEEP = '#A3231A'
    const GOLD = '#F0C27B'
    const TEXT = 'var(--dsw-alias-label-primary, #1f2328)'
    const MUTED = 'var(--dsw-alias-label-secondary, #5b6270)'
    const CAPTION = 'var(--dsw-alias-label-caption, #8b929c)'
    const BORDER = 'var(--dsw-alias-border-l4, rgba(0,0,0,0.09))'
    const SURFACE = 'var(--dsw-alias-bg-elevated, #ffffff)'

    // 翻牌器：每张牌只翻一次，动画分两段（旧值上半翻下去 → 新值下半翻上来），
    // 总时长 FLAP_MS，两段各一半。
    const FLAP_MS = 300
    const FLAP_HALF = FLAP_MS / 2
    const FACE_TOP = 'linear-gradient(180deg, rgba(46,12,9,0.56) 0%, rgba(28,7,5,0.5) 100%)'
    const FACE_BOTTOM = 'linear-gradient(180deg, rgba(22,5,4,0.5) 0%, rgba(34,9,7,0.54) 100%)'
    const FACE_EDGE = 'rgba(0,0,0,0.42)'
    const DIGIT_COLOR = '#FFF7F0'

    function mod(n, m) {
      return ((n % m) + m) % m
    }

    function pad2(n) {
      return String(n).padStart(2, '0')
    }

    function cnNumber(n) {
      if (n === 0) return '〇'
      if (n < 10) return CN_DIGITS[n]
      if (n === 10) return '十'
      if (n < 20) return `十${CN_DIGITS[n % 10]}`
      if (n < 30) return n === 20 ? '二十' : `廿${CN_DIGITS[n % 10]}`
      if (n === 30) return '三十'
      return String(n)
    }

    function dayNumber(y, m, d) {
      return Math.round(Date.UTC(y, m - 1, d) / DAY)
    }

    function fromDayNumber(n) {
      const d = new Date(n * DAY)
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
    }

    function isoOf(n) {
      const p = fromDayNumber(n)
      return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
    }

    function parseDay(iso) {
      const parts = iso.split('-').map(Number)
      return dayNumber(parts[0], parts[1], parts[2])
    }

    function yearInfo(y) {
      const stem = STEMS[mod(y - 4, 10)]
      const branch = BRANCHES[mod(y - 4, 12)]
      const zodiac = ZODIACS[mod(y - 4, 12)]
      return { year: y, label: `${stem}${branch}年`, fullLabel: `${stem}${branch}年 · ${zodiac}年`, zodiac }
    }

    function springOf(y) {
      const iso = SPRING_TABLE[y]
      if (!iso) return null
      const n = parseDay(iso)
      return { year: y, iso, dayNumber: n, info: yearInfo(y), ...fromDayNumber(n) }
    }

    function holidayWindow(spring) {
      const official = HOLIDAY_TABLE[spring.year]
      if (official) {
        return { start: official.start, end: official.end, days: official.days, estimated: false }
      }
      return {
        start: isoOf(spring.dayNumber - 1),
        end: isoOf(spring.dayNumber + 6),
        days: 8,
        estimated: true,
      }
    }

    function midnight(y, m, d) {
      return new Date(y, m - 1, d).getTime()
    }

    function splitDuration(ms) {
      const v = Math.max(0, ms)
      return {
        days: Math.floor(v / DAY),
        hours: Math.floor((v % DAY) / 3600000),
        minutes: Math.floor((v % 3600000) / 60000),
        seconds: Math.floor((v % 60000) / 1000),
        totalMs: v,
      }
    }

    function buildSnapshot(nowMs) {
      const now = new Date(nowMs)
      const todayNum = dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate())
      let ty = now.getFullYear()
      let spring = springOf(ty)
      if (!spring) return null
      let win = holidayWindow(spring)
      if (todayNum > parseDay(win.end)) {
        ty += 1
        spring = springOf(ty)
        if (!spring) return null
        win = holidayWindow(spring)
      }

      const eveNum = spring.dayNumber - 1
      const eveDate = fromDayNumber(eveNum)
      const eveAt = midnight(eveDate.year, eveDate.month, eveDate.day)
      const dayAt = midnight(spring.year, spring.month, spring.day)

      const eve = {
        key: 'eve',
        name: '除夕',
        display: `${eveDate.month}月${eveDate.day}日`,
        weekday: WEEKDAYS[new Date(eveNum * DAY).getUTCDay()],
        lunarLabel: `腊月${cnNumber(29)}`,
        daysAway: eveNum - todayNum,
        remain: splitDuration(eveAt - nowMs),
        isToday: eveNum === todayNum,
      }
      const day = {
        key: 'day',
        name: '初一',
        display: `${spring.month}月${spring.day}日`,
        weekday: WEEKDAYS[new Date(spring.dayNumber * DAY).getUTCDay()],
        lunarLabel: '正月初一',
        daysAway: spring.dayNumber - todayNum,
        remain: splitDuration(dayAt - nowMs),
        isToday: spring.dayNumber === todayNum,
      }

      const milestones = [
        { key: 'xiaonian', name: '小年', num: spring.dayNumber - 7 },
        { key: 'eve', name: '除夕', num: eveNum },
        { key: 'spring', name: '春节', num: spring.dayNumber },
        { key: 'lantern', name: '元宵', num: spring.dayNumber + 14 },
      ].map((m) => {
        const c = fromDayNumber(m.num)
        return {
          key: m.key,
          name: m.name,
          display: `${c.month}月${c.day}日`,
          daysAway: m.num - todayNum,
          passed: m.num < todayNum,
        }
      })

      const startNum = parseDay(win.start)
      const endNum = parseDay(win.end)
      const phase = todayNum > endNum ? 'after' : todayNum >= startNum ? 'during' : 'before'

      const prevSpring = springOf(ty - 1)
      const span = prevSpring ? spring.dayNumber - prevSpring.dayNumber : 0
      const elapsed = prevSpring ? todayNum - prevSpring.dayNumber : 0

      return {
        info: spring.info,
        todayNum,
        now: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes(),
          second: now.getSeconds(),
          weekday: WEEKDAYS[now.getDay()],
        },
        eve,
        day,
        primary: eve.daysAway >= 0 ? 'eve' : 'day',
        milestones,
        holiday: {
          ...win,
          phase,
          startsInDays: startNum - todayNum,
          dayIndex: phase === 'during' ? todayNum - startNum + 1 : null,
          remainingDays: phase === 'during' ? endNum - todayNum : null,
        },
        progress: span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : 0,
      }
    }

    const badgeStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 34,
      height: 19,
      padding: '0 5px',
      borderRadius: 6,
      background: 'rgba(201,58,43,0.10)',
      color: RED,
      fontSize: 11,
      fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '0.2px',
    }

    function LanternIcon(props) {
      const size = props.size || 18
      // 侧栏底部的按钮在浅色面板上，用红灯笼；卡片头部是红色渐变，
      // 换成金身白穗，否则红底红灯笼基本看不见。
      const onRed = props.tone === 'light'
      const shell = onRed ? GOLD : RED
      const detail = onRed ? '#FFF7F0' : GOLD
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', { d: 'M12 2v3', stroke: detail, strokeWidth: 1.6, strokeLinecap: 'round' }),
        h('rect', { x: 5.2, y: 5, width: 13.6, height: 13.6, rx: 6.8, fill: shell }),
        h('path', { d: 'M8.4 12h7.2', stroke: detail, strokeWidth: 1.4, strokeLinecap: 'round', opacity: 0.95 }),
        h('path', { d: 'M12 15.4v3.2', stroke: shell, strokeWidth: 1.6, strokeLinecap: 'round' }),
        h('circle', { cx: 12, cy: 20.6, r: 1.4, fill: shell }),
      )
    }

    /**
     * 单张翻牌。值变化时旧值上半向下翻、新值下半接上，两段共 FLAP_MS。
     * 只有值真的变了才翻，所以「分」位每分钟才动一次，「秒」位每秒动一次。
     */
    function FlipDigit(props) {
      const { value, width, height, fontSize, radius = 5 } = props
      const text = String(value)
      const [shown, setShown] = React.useState(text)
      const [from, setFrom] = React.useState(text)
      const [flipping, setFlipping] = React.useState(false)
      const shownRef = React.useRef(text)

      React.useEffect(() => {
        if (text === shownRef.current) return undefined
        const previous = shownRef.current
        shownRef.current = text
        setFrom(previous)
        setShown(text)
        setFlipping(true)
        const timer = setTimeout(() => setFlipping(false), FLAP_MS)
        return () => clearTimeout(timer)
      }, [text])

      const half = height / 2

      // 半张牌：数字按整牌高度排版，再用负 margin 把对应的那一半顶进视窗。
      const faceText = (content, isTop) =>
        h(
          'span',
          {
            style: {
              display: 'block',
              width: '100%',
              height,
              lineHeight: `${height}px`,
              textAlign: 'center',
              fontSize,
              fontWeight: 700,
              color: DIGIT_COLOR,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.5px',
              marginTop: isTop ? 0 : -half,
            },
          },
          content,
        )

      const halfLayer = (content, isTop, extra) =>
        h(
          'div',
          {
            style: {
              position: 'absolute',
              left: 0,
              right: 0,
              height: half,
              overflow: 'hidden',
              background: isTop ? FACE_TOP : FACE_BOTTOM,
              backfaceVisibility: 'hidden',
              ...(isTop
                ? { top: 0, borderRadius: `${radius}px ${radius}px 0 0` }
                : { bottom: 0, borderRadius: `0 0 ${radius}px ${radius}px` }),
              ...extra,
            },
          },
          faceText(content, isTop),
        )

      return h(
        'div',
        {
          style: {
            position: 'relative',
            width,
            height,
            flex: '0 0 auto',
            perspective: 320,
            borderRadius: radius,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.22)',
          },
          'aria-hidden': 'true',
        },
        // 静止层：上半恒为当前值；下半在翻转期间保留旧值，翻完才换成新值。
        halfLayer(shown, true),
        halfLayer(flipping ? from : shown, false),
        flipping
          ? halfLayer(from, true, {
              zIndex: 3,
              transformOrigin: 'bottom center',
              animation: `dsh-flap-top ${FLAP_HALF}ms ease-in forwards`,
            })
          : null,
        flipping
          ? halfLayer(shown, false, {
              zIndex: 4,
              transformOrigin: 'top center',
              animation: `dsh-flap-bottom ${FLAP_HALF}ms ${FLAP_HALF}ms ease-out both`,
            })
          : null,
        h('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: half - 0.5,
            height: 1,
            background: FACE_EDGE,
            zIndex: 5,
            pointerEvents: 'none',
          },
        }),
      )
    }

    /** 把一串数字拆成独立的牌，供天数和时分秒共用。 */
    function flipDigits(text, options, keyPrefix) {
      return String(text)
        .split('')
        .map((ch, index) =>
          h(FlipDigit, { key: `${keyPrefix}-${index}`, value: ch, ...options }),
        )
    }

    function CountdownButton(props) {
      const wide = props.wide !== false
      const [open, setOpen] = React.useState(false)
      const [hover, setHover] = React.useState(false)
      const [now, setNow] = React.useState(() => Date.now())
      const btnRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const [pos, setPos] = React.useState(null)

      const snapshot = React.useMemo(() => buildSnapshot(now), [now])
      const badgeDays = snapshot ? (snapshot.eve.daysAway >= 0 ? snapshot.eve.daysAway : snapshot.day.daysAway) : null

      React.useEffect(() => {
        if (!open) return undefined
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [open])

      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const node = btnRef.current
          if (!node) return
          const rect = node.getBoundingClientRect()
          setPos({
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
            bottom: Math.max(8, window.innerHeight - rect.top + 8),
          })
        }
        place()
        window.addEventListener('resize', place)
        return () => window.removeEventListener('resize', place)
      }, [open])

      React.useEffect(() => {
        if (!open) return undefined
        const onPointer = (event) => {
          const t = event.target
          if (panelRef.current && panelRef.current.contains(t)) return
          if (btnRef.current && btnRef.current.contains(t)) return
          setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointer, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          document.removeEventListener('mousedown', onPointer, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [open])

      const buttonStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 32,
        padding: wide ? '0 8px' : 0,
        width: wide ? 'auto' : 32,
        justifyContent: 'center',
        border: 'none',
        borderRadius: 8,
        background: hover || open ? 'var(--dsw-alias-bg-muted, rgba(0,0,0,0.055))' : 'transparent',
        color: TEXT,
        font: 'inherit',
        fontSize: 13,
        fontWeight: 500,
        lineHeight: '20px',
        cursor: 'pointer',
        transition: 'background 120ms ease',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }

      const button = h(
        'button',
        {
          ref: btnRef,
          type: 'button',
          title: snapshot ? `距离${snapshot.eve.name}还有 ${badgeDays} 天` : '春节倒计时',
          'aria-haspopup': 'dialog',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setOpen((v) => !v),
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          style: buttonStyle,
        },
        h(LanternIcon, { size: wide ? 17 : 18 }),
        wide ? h('span', { style: { flex: '1 1 auto', textAlign: 'left' } }, '倒计时') : null,
        wide && badgeDays !== null ? h('span', { style: badgeStyle }, `${badgeDays}天`) : null,
      )

      return h(React.Fragment, null, button, open && snapshot ? renderPanel(snapshot, pos, panelRef, () => setOpen(false)) : null)
    }

    function renderPanel(snapshot, pos, panelRef, onClose) {
      const panel = h(CountdownPanel, { snapshot, pos, panelRef, onClose })
      if (ReactDOM && typeof ReactDOM.createPortal === 'function') {
        return ReactDOM.createPortal(panel, document.body)
      }
      return panel
    }

    function CountdownPanel(props) {
      const { snapshot, pos, panelRef, onClose } = props
      const { eve, day, now } = snapshot
      const primary = snapshot.primary === 'day' ? day : eve
      const remain = primary.remain
      const passed = primary.daysAway < 0
      const holiday = snapshot.holiday

      // 天数不定长（多数时候两位，春节刚过时三位），牌数跟着变，
      // 但最少保持两位，免得每年那几天宽度突然塌一下。
      const daysValue = primary.isToday ? 0 : Math.abs(primary.daysAway)
      const daysText = daysValue < 100 ? pad2(daysValue) : String(daysValue)
      const dayFace = { width: 36, height: 50, fontSize: 32 }
      const timeFace = { width: 28, height: 40, fontSize: 25 }
      const timeCards = []
      ;[remain.hours, remain.minutes, remain.seconds].forEach((unit, index) => {
        if (index > 0) {
          timeCards.push(
            h(
              'span',
              {
                key: `sep-${index}`,
                style: {
                  fontSize: 20,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: 'rgba(255,240,228,0.62)',
                  margin: '0 2px',
                },
              },
              ':',
            ),
          )
        }
        timeCards.push(...flipDigits(pad2(unit), timeFace, `t${index}`))
      })

      const shell = {
        position: 'fixed',
        left: 12,
        bottom: 72,
        width: 304,
        zIndex: 9999,
        borderRadius: 14,
        overflow: 'hidden',
        background: SURFACE,
        border: `0.5px solid ${BORDER}`,
        boxShadow: '0 16px 40px rgba(20, 16, 12, 0.18), 0 2px 8px rgba(20, 16, 12, 0.08)',
        font: 'inherit',
        animation: 'dsh-spring-countdown-in 160ms cubic-bezier(0.2, 0.8, 0.3, 1)',
      }
      if (pos) {
        shell.left = pos.left
        shell.bottom = pos.bottom
      }

      const header = h(
        'div',
        {
          style: {
            position: 'relative',
            padding: '15px 16px 16px',
            background: `linear-gradient(135deg, ${RED} 0%, ${RED_DEEP} 100%)`,
            color: '#FFF7F0',
          },
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: GOLD, fontWeight: 600 } },
            h(LanternIcon, { size: 14, tone: 'light' }),
            h('span', null, `${snapshot.info.label} · ${snapshot.info.zodiac}年`),
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: onClose,
              'aria-label': '关闭',
              style: {
                width: 22,
                height: 22,
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.16)',
                color: '#FFF7F0',
                fontSize: 13,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 0,
              },
            },
            '✕',
          ),
        ),
        h(
          'div',
          { style: { fontSize: 12, color: 'rgba(255,247,240,0.8)', marginBottom: 10, textAlign: 'center' } },
          primary.isToday ? `今天是${primary.name}` : passed ? `${primary.name}已过` : `距离${primary.name}`,
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 } },
          flipDigits(daysText, dayFace, 'd'),
          h(
            'span',
            { style: { fontSize: 15, fontWeight: 600, color: GOLD } },
            '天',
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 9 } },
          timeCards,
        ),
      )

      const row = (item, accent) =>
        h(
          'div',
          {
            key: item.key,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 0',
              borderBottom: `0.5px solid ${BORDER}`,
            },
          },
          h('span', {
            style: {
              width: 6,
              height: 6,
              borderRadius: 3,
              background: accent ? RED : 'transparent',
              border: accent ? 'none' : `1px solid ${CAPTION}`,
              flex: '0 0 auto',
            },
          }),
          h(
            'span',
            { style: { fontSize: 13, fontWeight: 600, color: accent ? TEXT : MUTED, minWidth: 30 } },
            item.name,
          ),
          h('span', { style: { fontSize: 12, color: MUTED } }, `${item.display} ${item.weekday}`),
          h(
            'span',
            {
              style: {
                marginLeft: 'auto',
                fontSize: 12,
                color: accent ? RED : MUTED,
                fontWeight: accent ? 600 : 400,
                fontVariantNumeric: 'tabular-nums',
              },
            },
            item.daysAway === 0 ? '今天' : item.daysAway > 0 ? `${item.daysAway} 天` : `已过 ${Math.abs(item.daysAway)} 天`,
          ),
        )

      const pct = Math.round(snapshot.progress * 100)
      const upcoming = snapshot.milestones.filter((m) => m.daysAway > 0).slice(0, 2)

      const body = h(
        'div',
        { style: { padding: '8px 16px 14px' } },
        row(eve, true),
        row(day, false),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12 } },
          h('span', { style: { fontSize: 11, color: CAPTION, whiteSpace: 'nowrap' } }, '这一轮'),
          h(
            'div',
            {
              style: {
                flex: '1 1 auto',
                height: 5,
                borderRadius: 3,
                background: 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              },
            },
            h('div', {
              style: {
                width: `${pct}%`,
                height: '100%',
                borderRadius: 3,
                background: `linear-gradient(90deg, ${GOLD}, ${RED})`,
                transition: 'width 400ms ease',
              },
            }),
          ),
          h(
            'span',
            { style: { fontSize: 11, color: CAPTION, fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right' } },
            `${pct}%`,
          ),
        ),
        h(
          'div',
          { style: { marginTop: 12, paddingTop: 10, borderTop: `0.5px solid ${BORDER}`, display: 'grid', gap: 5 } },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED } },
            h('span', null, '春节假期'),
            h(
              'span',
              { style: { color: holiday.phase === 'during' ? RED : MUTED, fontWeight: holiday.phase === 'during' ? 600 : 400 } },
              holiday.phase === 'during'
                ? `第 ${holiday.dayIndex}/${holiday.days} 天 · 还剩 ${holiday.remainingDays} 天`
                : holiday.phase === 'before'
                  ? `${holiday.startsInDays} 天后开始 · ${holiday.days} 天`
                  : `已结束 · ${holiday.days} 天`,
            ),
          ),
          upcoming.length
            ? h(
                'div',
                { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED } },
                h('span', null, '接下来'),
                h(
                  'span',
                  null,
                  upcoming.map((m) => `${m.name} ${m.display}`).join(' · '),
                ),
              )
            : null,
        ),
        h(
          'div',
          {
            style: {
              marginTop: 10,
              paddingTop: 9,
              borderTop: `0.5px solid ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              fontSize: 11,
              color: CAPTION,
              fontVariantNumeric: 'tabular-nums',
            },
          },
          h('span', null, `${now.year}年${now.month}月${now.day}日`),
          h('span', { style: { color: MUTED } }, now.weekday),
          h('span', {
            style: {
              width: 1,
              height: 9,
              background: 'currentColor',
              opacity: 0.32,
              display: 'inline-block',
            },
          }),
          h(
            'span',
            { style: { color: TEXT, fontWeight: 600, letterSpacing: '0.4px' } },
            `${pad2(now.hour)}:${pad2(now.minute)}:${pad2(now.second)}`,
          ),
        ),
      )

      return h(
        'div',
        { ref: panelRef, role: 'dialog', 'aria-label': '春节倒计时', style: shell },
        h(
          'style',
          null,
          '@keyframes dsh-spring-countdown-in{from{opacity:0;transform:translateY(6px) scale(0.985)}to{opacity:1;transform:none}}' +
            '@keyframes dsh-flap-top{from{transform:rotateX(0deg)}to{transform:rotateX(-90deg)}}' +
            '@keyframes dsh-flap-bottom{from{transform:rotateX(90deg)}to{transform:rotateX(0deg)}}',
        ),
        header,
        body,
      )
    }

    function apply(ctx) {
      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'spring-countdown',
            order: 10,
            label: () => '倒计时',
          },
          CountdownButton,
        ),
      )
    }

    return { name: 'dsh-spring-countdown', inject: ['slots'], apply }
  },
})
