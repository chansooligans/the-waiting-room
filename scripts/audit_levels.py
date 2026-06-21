#!/usr/bin/env python3
"""Static "simulate-play" audit of the level arc. For each level checks:
giver NPC exists, giver is PLACED at the level, the placement's ROOM is
UNLOCKED by that level (reachability), the dialogue exists with a speaker,
the dialogue descends to the encounter, the encounter has a prototype, a WR
obstacle exists, and a mini-map hint is present. Pure regex over src/."""
import re, sys, os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R=lambda p: open(os.path.join(ROOT,p),encoding="utf-8").read()
levels=R("src/content/levels.ts"); dlg=R("src/content/dialogue.ts"); npcs=R("src/content/npcs.ts")
mp=R("src/content/maps/level1.ts"); enem=R("src/content/enemies.ts"); wr=R("src/scenes/WaitingRoomScene.ts")
flav=R("src/scenes/hospitalFlavor.ts"); state=R("src/state.ts")

NPC_NAME=dict(re.findall(r"id: '([a-z_]+)',\n    name: '([^']+)'", npcs))

# room consts: NAME -> (x,y,w,h)
CONST={m.group(1):tuple(map(int,m.groups()[1:])) for m in
       re.finditer(r"const ([A-Z_]+)\s*=\s*\{ x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)", mp)}
# roomDefs: spread-const -> lock ; and rooms list (bounds,lock)
ROOMS=[]; CONST_LOCK={}
for blk in re.findall(r"\{\s*id: '[a-z_]+',(?:[^{}]|\{[^{}]*\})*?\}", mp, re.S):
    if 'lockedUntilLevel' not in blk and '...' not in blk: continue
    sp=re.search(r"\.\.\.([A-Z_]+)", blk); lock=re.search(r"lockedUntilLevel: (\d+)", blk)
    lk=int(lock.group(1)) if lock else 1
    if sp and sp.group(1) in CONST:
        CONST_LOCK[sp.group(1)]=lk; ROOMS.append((CONST[sp.group(1)],lk))
def room_lock_for_tile(x,y):
    for (rx,ry,rw,rh),lk in ROOMS:
        if rx<=x<rx+rw and ry<=y<ry+rh: return lk
    return 1  # corridor / open

# placements in array order: npcId -> [(xexpr,yexpr,levels_or_None)]
PLACE={}
for m in re.finditer(r"npcId: '([a-z_]+)',\s*tileX: ([^,]+),\s*tileY: ([^,]+),(.*?)(?:\}|\n)", mp):
    nid=m.group(1); lv=re.search(r"levels: \[([^\]]*)\]", m.group(4))
    lvset=set(int(x) for x in re.findall(r"\d+",lv.group(1))) if lv else None
    PLACE.setdefault(nid,[]).append((m.group(2).strip(),m.group(3).strip(),lvset))
def resolve(expr):
    m=re.match(r"([A-Z_]+)\.[xy]\s*\+?\s*(\d+)?",expr)
    if m: base=CONST.get(m.group(1)); 
    if m and base:
        return ('const',m.group(1),int(m.group(2) or 0))
    n=re.match(r"(\d+)$",expr); return ('abs',int(n.group(1))) if n else ('?',0)
def reach(nid, lvl):
    """return (placed, room_lock or None). picks first placement matching lvl."""
    for xe,ye,lvset in PLACE.get(nid,[]):
        if lvset is None or lvl in lvset:
            rx=resolve(xe); ry=resolve(ye)
            if rx[0]=='const': lk=CONST_LOCK.get(rx[1],1)
            elif rx[0]=='abs' and ry[0]=='abs': lk=room_lock_for_tile(rx[1],ry[1])
            else: lk=1
            return True, lk
    return False, None

LV={}
for b in re.findall(r"\{\s*id: (\d+),(.*?)\n  \},", levels, re.S):
    lid=int(b[0]); enc=re.search(r"encounters: \[([^\]]*)\]",b[1]); na=re.search(r"npcsActive: \[([^\]]*)\]",b[1]); bo=re.search(r"bossEncounter: '([^']+)'",b[1])
    LV[lid]={'enc':re.findall(r"'([^']+)'",enc.group(1)) if enc else [],'npcs':re.findall(r"'([^']+)'",na.group(1)) if na else [],'boss':bo.group(1) if bo else None}
N=len(LV)
LND={}; body=dlg[dlg.index("LEVEL_NPC_DIALOGUES"):]; body=body[body.index("= {")+3:]
for m in re.finditer(r"^  (\d+):\s*\{([^}]*)\}",body,re.M): LND[int(m.group(1))]=dict(re.findall(r"(\w+): '([^']+)'",m.group(2)))
NODE_SPK=dict(re.findall(r"\n  \w+: \{\n    id: '([^']+)',\n    speaker: '([^']+)'",dlg))
DESC=set(re.findall(r"triggerDescent: \{ encounterId: '([^']+)' \}",dlg))
ENC_PROTO={m.group(1):"prototypeIframeUrl:" in m.group(2) for m in re.finditer(r"^  (\w+): \{(.*?)\n  \},",enem,re.S|re.M)}
OBST=set(re.findall(r"encounterId: '([^']+)'",wr))
HINTS=set(int(x) for x in re.findall(r"^  (\d+):\s*'",flav[flav.index("LEVEL_ORIENTATION_HINTS"):],re.M))
THR=len(re.findall(r"^\s*\d+,\s*//",state[state.index("LEVEL_DEFEAT_THRESHOLD"):],re.M))

issues=[]
print(f"{'L':>2} {'encounter':30} {'giver':14} {'room✓':6} flow")
for L in range(1,N+1):
    d=LV[L]; enc=d['boss'] or (d['enc'][0] if d['enc'] else None)
    givers=list(LND.get(L,{}).keys()) or ([d['npcs'][0]] if d['npcs'] else [])
    fl=[]; rsum=[]
    for g in givers:
        if g not in NPC_NAME: fl.append(f"npc!{g}"); continue
        placed,lk=reach(g,L)
        if not placed: fl.append(f"unplaced:{g}")
        elif lk>L: fl.append(f"LOCKED:{g}(room@{lk}>L{L})")
        else: rsum.append(f"{g}@lk{lk}")
    for g,did in LND.get(L,{}).items():
        if did not in NODE_SPK: fl.append(f"dlg!{did}")
    if L!=1 and enc and enc not in DESC: fl.append("no-descent")
    if enc not in ENC_PROTO or not ENC_PROTO.get(enc): fl.append("no-prototype")
    if enc not in OBST: fl.append("no-WR")
    if L not in HINTS and L!=1: fl.append("no-hint")
    st="✓" if not fl else "✗ "+" ".join(fl)
    print(f"{L:>2} {(enc or '-')[:30]:30} {givers[0][:14]:14} {('ok' if not [f for f in fl if 'LOCK' in f or 'unplaced' in f] else 'NO'):6} {st}")
    if fl: issues.append((L,fl))
print(f"\nthreshold={THR} levels={N} {'OK' if THR==N else 'MISMATCH'}")
print("=== ALL PASS ✓ ===" if not issues else f"=== {len(issues)} ISSUE(S) ===")
for L,fl in issues: print(f"  L{L}: {fl}")
sys.exit(1 if issues else 0)
