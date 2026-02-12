// Aurora Art Generator v3.0
// Informed by Digital Painting Masters principles:
// VALUE before COLOR, depth zones, form & light, limited palettes
// All outputs optimized for <4K chars (safe for Bankr 10K limit)

class ArtGenerator {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
    this.palettes = [
      { name: 'desert twilight',  colors: ['#1a0533', '#2d1b69', '#e85d04', '#ff8c42', '#ffd166'], bg: '#0a0a1a', accent: '#ff6b35' },
      { name: 'arctic aurora',    colors: ['#0a0e27', '#1a2744', '#2d6a4f', '#40916c', '#95d5b2'], bg: '#03071e', accent: '#52b788' },
      { name: 'blood moon',       colors: ['#0d0d0d', '#1a0a0a', '#4a1a2e', '#8b2500', '#cc4400'], bg: '#0a0a0a', accent: '#ff4500' },
      { name: 'lavender dusk',    colors: ['#0a0a2e', '#2d1b69', '#7b2d8b', '#c77dff', '#e0aaff'], bg: '#0a0a1e', accent: '#9d4edd' },
      { name: 'golden hour',      colors: ['#1a1a2e', '#3d2645', '#832161', '#da4167', '#f0c808'], bg: '#0f0f1a', accent: '#f0c808' },
      { name: 'deep ocean',       colors: ['#03071e', '#0a1128', '#001d3d', '#003566', '#0077b6'], bg: '#020810', accent: '#00b4d8' },
      { name: 'neon desert',      colors: ['#0f0326', '#2b0a3d', '#5a189a', '#ff006e', '#fb5607'], bg: '#0a0216', accent: '#ff006e' },
      { name: 'moonrise',         colors: ['#03071e', '#0d1b2a', '#1b263b', '#415a77', '#778da9'], bg: '#020510', accent: '#e0e1dd' },
      { name: 'ember glow',       colors: ['#10002b', '#240046', '#3c096c', '#e63946', '#f4a261'], bg: '#0a0016', accent: '#e63946' },
      { name: 'forest mist',      colors: ['#0b1215', '#1a2e1a', '#2d5a27', '#6b8f71', '#adc178'], bg: '#060d08', accent: '#a7c957' },
    ];
  }

  generateRandomArt() {
    var p = this.randomPalette();
    var roll = Math.random();
    var art;
    if (roll < 0.15) art = this._noiseLandscape(p);
    else if (roll < 0.30) art = this._flowField(p);
    else if (roll < 0.44) art = this._constellation(p);
    else if (roll < 0.58) art = this._geometricTowers(p);
    else if (roll < 0.72) art = this._spiralNebula(p);
    else if (roll < 0.86) art = this._lightCurtain(p);
    else art = this._organicCells(p);
    return this.minifySvg(art);
  }

  // 1. NOISE LANDSCAPE — mountains, water, reflections
  _noiseLandscape(p) {
    var el = '';
    for (var i = 0; i < 12; i++) {
      var x = Math.random()*400, y = Math.random()*180;
      el += '<circle cx="'+x.toFixed(0)+'" cy="'+y.toFixed(0)+'" r="'+(0.3+Math.random()*1.2).toFixed(1)+'" fill="#fff" opacity="'+(0.3+Math.random()*0.7).toFixed(2)+'"/>';
    }
    var mx = 60+Math.random()*280, my = 40+Math.random()*80;
    var mr = [15, 30, 55][Math.floor(Math.random()*3)];
    el += '<circle cx="'+mx.toFixed(0)+'" cy="'+my.toFixed(0)+'" r="'+(mr*2.5).toFixed(0)+'" fill="url(#glow)" opacity="0.4"/>';
    el += '<circle cx="'+mx.toFixed(0)+'" cy="'+my.toFixed(0)+'" r="'+mr+'" fill="'+p.accent+'" opacity="0.9"/>';
    var sharp = Math.random() > 0.5;
    var layers = 3 + Math.floor(Math.random()*2);
    for (var layer = 0; layer < layers; layer++) {
      var baseY = 180+layer*45, seed = Math.random()*100, amp = 55-layer*10;
      var t = (layer+1)/(layers+1);
      var color = this._lerp(p.colors[1], p.colors[0], t);
      var d = 'M-5,400 L-5,'+baseY;
      if (sharp) {
        for (var lx = 0; lx <= 400; lx += 35+Math.random()*20) {
          d += ' L'+lx.toFixed(0)+','+(baseY-amp*Math.abs(Math.sin(lx*0.02+seed))*(0.5+Math.random()*0.5)).toFixed(0);
        }
      } else {
        for (var lx = -5; lx <= 405; lx += 12) {
          d += ' L'+lx+','+(baseY-amp*(0.5*Math.sin(lx*0.015+seed)+0.3*Math.sin(lx*0.03+seed*2.7)+0.2*Math.sin(lx*0.06+seed*5.1))).toFixed(0);
        }
      }
      d += ' L405,400 Z';
      el += '<path d="'+d+'" fill="'+color+'" opacity="'+(0.5+t*0.4).toFixed(2)+'"/>';
    }
    if (Math.random() > 0.4) {
      var wY = 300+Math.floor(Math.random()*40);
      el += '<rect x="0" y="'+wY+'" width="400" height="'+(400-wY)+'" fill="'+p.colors[0]+'" opacity="0.5"/>';
      el += '<ellipse cx="'+mx.toFixed(0)+'" cy="'+(wY+35).toFixed(0)+'" rx="'+(mr*0.4).toFixed(0)+'" ry="'+(mr*1.2).toFixed(0)+'" fill="'+p.accent+'" opacity="0.25"/>';
      for (var ring = 0; ring < 2; ring++) {
        el += '<ellipse cx="'+mx.toFixed(0)+'" cy="'+(wY+35+ring*8).toFixed(0)+'" rx="'+(20+ring*25)+'" ry="'+(4+ring*5)+'" fill="none" stroke="'+p.accent+'" stroke-width="0.5" opacity="0.2"/>';
      }
    }
    return this._wrap(p, el, true);
  }

  // 2. FLOW FIELD — particles following invisible forces
  _flowField(p) {
    var el = '';
    var cols = [p.colors[2], p.colors[3], p.accent];
    var s1 = Math.random()*10, s2 = Math.random()*10;
    for (var i = 0; i < 18; i++) {
      var x = Math.random()*400, y = Math.random()*400;
      var color = cols[Math.floor(Math.random()*cols.length)];
      var d = 'M'+x.toFixed(0)+','+y.toFixed(0);
      for (var s = 0; s < 6; s++) {
        var angle = Math.sin(x*0.01+s1)*3 + Math.cos(y*0.01+s2)*3;
        x += Math.cos(angle)*8; y += Math.sin(angle)*8;
        d += ' L'+x.toFixed(0)+','+y.toFixed(0);
      }
      el += '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+(0.5+Math.random()*1.5).toFixed(1)+'" opacity="'+(0.1+Math.random()*0.3).toFixed(2)+'" stroke-linecap="round"/>';
    }
    var gx = 100+Math.random()*200, gy = 100+Math.random()*200;
    el += '<circle cx="'+gx.toFixed(0)+'" cy="'+gy.toFixed(0)+'" r="60" fill="url(#glow)" opacity="0.5"/>';
    el += '<circle cx="'+gx.toFixed(0)+'" cy="'+gy.toFixed(0)+'" r="8" fill="'+p.accent+'" opacity="0.9"/>';
    return this._wrap(p, el, true);
  }

  // 3. CONSTELLATION — connected stars, nebula glow
  _constellation(p) {
    var el = '';
    for (var b = 0; b < 3; b++) {
      el += '<circle cx="'+(Math.random()*400).toFixed(0)+'" cy="'+(Math.random()*400).toFixed(0)+'" r="'+(40+Math.random()*80).toFixed(0)+'" fill="'+p.colors[2]+'" opacity="0.08"/>';
    }
    var nodes = [];
    for (var i = 0; i < 14; i++) {
      var nx = 20+Math.random()*360, ny = 20+Math.random()*360;
      var nr = (0.8+Math.random()*2.5).toFixed(1);
      nodes.push({x:nx,y:ny});
      el += '<circle cx="'+nx.toFixed(0)+'" cy="'+ny.toFixed(0)+'" r="'+nr+'" fill="#fff" opacity="'+(0.4+Math.random()*0.6).toFixed(2)+'"/>';
      if (Math.random()>0.6) el += '<circle cx="'+nx.toFixed(0)+'" cy="'+ny.toFixed(0)+'" r="'+(parseFloat(nr)*4).toFixed(0)+'" fill="'+p.accent+'" opacity="0.06"/>';
    }
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i+1; j < nodes.length; j++) {
        var dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
        if (Math.sqrt(dx*dx+dy*dy) < 90 && Math.random()>0.5) {
          el += '<line x1="'+nodes[i].x.toFixed(0)+'" y1="'+nodes[i].y.toFixed(0)+'" x2="'+nodes[j].x.toFixed(0)+'" y2="'+nodes[j].y.toFixed(0)+'" stroke="'+p.colors[3]+'" stroke-width="0.4" opacity="'+(0.15+Math.random()*0.2).toFixed(2)+'"/>';
        }
      }
    }
    var cx = 120+Math.random()*160, cy = 120+Math.random()*160;
    el += '<circle cx="'+cx.toFixed(0)+'" cy="'+cy.toFixed(0)+'" r="50" fill="url(#glow)" opacity="0.4"/>';
    el += '<circle cx="'+cx.toFixed(0)+'" cy="'+cy.toFixed(0)+'" r="5" fill="#fff" opacity="0.95"/>';
    return this._wrap(p, el, true);
  }

  // 4. GEOMETRIC TOWERS — crystal/city formations
  _geometricTowers(p) {
    var el = '';
    for (var i = 0; i < 10; i++) {
      el += '<circle cx="'+(Math.random()*400).toFixed(0)+'" cy="'+(Math.random()*150).toFixed(0)+'" r="'+(0.5+Math.random()).toFixed(1)+'" fill="#fff" opacity="'+(0.3+Math.random()*0.5).toFixed(2)+'"/>';
    }
    var tc = 5+Math.floor(Math.random()*5);
    for (var i = 0; i < tc; i++) {
      var tx = 20+(i/tc)*350+Math.random()*30, tw = 15+Math.random()*35;
      var th = 80+Math.random()*200, ty = 400-th;
      var color = this._lerp(p.colors[1], p.colors[3], Math.random());
      var op = (0.4+Math.random()*0.4).toFixed(2);
      el += '<rect x="'+tx.toFixed(0)+'" y="'+ty.toFixed(0)+'" width="'+tw.toFixed(0)+'" height="'+th.toFixed(0)+'" fill="'+color+'" opacity="'+op+'"/>';
      if (Math.random()>0.3) {
        for (var w = 0; w < 3; w++) {
          el += '<rect x="'+(tx+2+Math.random()*(tw-6)).toFixed(0)+'" y="'+(ty+10+Math.random()*(th-20)).toFixed(0)+'" width="3" height="2" fill="'+p.accent+'" opacity="'+(0.3+Math.random()*0.5).toFixed(2)+'"/>';
        }
      }
      if (Math.random()>0.5) el += '<polygon points="'+tx.toFixed(0)+','+ty.toFixed(0)+' '+(tx+tw/2).toFixed(0)+','+(ty-20-Math.random()*30).toFixed(0)+' '+(tx+tw).toFixed(0)+','+ty.toFixed(0)+'" fill="'+color+'" opacity="'+op+'"/>';
    }
    var mx = 80+Math.random()*240, my = 40+Math.random()*80;
    el += '<circle cx="'+mx.toFixed(0)+'" cy="'+my.toFixed(0)+'" r="35" fill="url(#glow)" opacity="0.5"/>';
    el += '<circle cx="'+mx.toFixed(0)+'" cy="'+my.toFixed(0)+'" r="12" fill="'+p.accent+'" opacity="0.85"/>';
    el += '<rect x="0" y="360" width="400" height="40" fill="'+p.colors[1]+'" opacity="0.3"/>';
    return this._wrap(p, el, true);
  }

  // 5. SPIRAL NEBULA — rotating arms of particles
  _spiralNebula(p) {
    var el = '';
    var cx = 160+Math.random()*80, cy = 160+Math.random()*80;
    var arms = 2+Math.floor(Math.random()*2);
    var cols = [p.colors[2], p.colors[3], p.accent];
    for (var arm = 0; arm < arms; arm++) {
      var baseAngle = (arm/arms)*Math.PI*2;
      var color = cols[arm%cols.length];
      for (var i = 0; i < 14; i++) {
        var t = i/14;
        var angle = baseAngle+t*Math.PI*3+Math.random()*0.3;
        var dist = 10+t*160+Math.random()*15;
        var x = cx+Math.cos(angle)*dist, y = cy+Math.sin(angle)*dist;
        if (x<-5||x>405||y<-5||y>405) continue;
        el += '<circle cx="'+x.toFixed(0)+'" cy="'+y.toFixed(0)+'" r="'+(0.5+(1-t)*2.5+Math.random()).toFixed(1)+'" fill="'+color+'" opacity="'+(0.1+(1-t)*0.5).toFixed(2)+'"/>';
      }
    }
    el += '<circle cx="'+cx.toFixed(0)+'" cy="'+cy.toFixed(0)+'" r="50" fill="url(#glow)" opacity="0.6"/>';
    el += '<circle cx="'+cx.toFixed(0)+'" cy="'+cy.toFixed(0)+'" r="10" fill="#fff" opacity="0.9"/>';
    for (var i = 0; i < 8; i++) {
      el += '<circle cx="'+(Math.random()*400).toFixed(0)+'" cy="'+(Math.random()*400).toFixed(0)+'" r="0.5" fill="#fff" opacity="'+(0.2+Math.random()*0.4).toFixed(2)+'"/>';
    }
    return this._wrap(p, el, true);
  }

  // 6. LIGHT CURTAIN — aurora borealis / vertical bands
  _lightCurtain(p) {
    var el = '';
    for (var i = 0; i < 15; i++) {
      el += '<circle cx="'+(Math.random()*400).toFixed(0)+'" cy="'+(Math.random()*250).toFixed(0)+'" r="'+(0.3+Math.random()).toFixed(1)+'" fill="#fff" opacity="'+(0.3+Math.random()*0.5).toFixed(2)+'"/>';
    }
    var cols = [p.colors[2], p.colors[3], p.accent];
    for (var b = 0; b < 5; b++) {
      var bx = 20+(b/5)*360+Math.random()*30, seed = Math.random()*10;
      var color = cols[Math.floor(Math.random()*cols.length)];
      var bw = 15+Math.random()*40;
      var d = 'M'+bx.toFixed(0)+',0';
      for (var by = 0; by <= 300; by += 20) {
        d += ' L'+(bx+Math.sin(by*0.02+seed)*30+Math.sin(by*0.05+seed*2)*15).toFixed(0)+','+by;
      }
      d += ' L'+(bx+bw).toFixed(0)+',300';
      for (var by = 300; by >= 0; by -= 20) {
        d += ' L'+(bx+Math.sin(by*0.02+seed)*30+Math.sin(by*0.05+seed*2)*15+bw).toFixed(0)+','+by;
      }
      d += ' Z';
      el += '<path d="'+d+'" fill="'+color+'" opacity="'+(0.06+Math.random()*0.1).toFixed(2)+'"/>';
    }
    var gd = 'M0,400 L0,320';
    for (var gx = 0; gx <= 400; gx += 25) {
      gd += ' L'+gx+','+(320-Math.sin(gx*0.02+3)*15-Math.sin(gx*0.05)*8).toFixed(0);
    }
    gd += ' L400,400 Z';
    el += '<path d="'+gd+'" fill="'+p.colors[0]+'" opacity="0.85"/>';
    return this._wrap(p, el, true);
  }

  // 7. ORGANIC CELLS — translucent overlapping blobs
  _organicCells(p) {
    var el = '';
    var cols = [p.colors[1], p.colors[2], p.colors[3], p.accent];
    for (var i = 0; i < 10; i++) {
      var cx = Math.random()*400, cy = Math.random()*400;
      var pts = 6+Math.floor(Math.random()*4);
      var bR = 20+Math.random()*50;
      var d = '';
      for (var j = 0; j <= pts; j++) {
        var angle = (j/pts)*Math.PI*2;
        var r = bR+Math.sin(angle*3+i)*bR*0.3;
        d += (j===0?'M':' L')+(cx+Math.cos(angle)*r).toFixed(0)+','+(cy+Math.sin(angle)*r).toFixed(0);
      }
      d += ' Z';
      var color = cols[Math.floor(Math.random()*cols.length)];
      var op = (0.05+Math.random()*0.15).toFixed(2);
      el += '<path d="'+d+'" fill="'+color+'" opacity="'+op+'"/>';
      el += '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="0.5" opacity="'+(parseFloat(op)+0.1).toFixed(2)+'"/>';
    }
    var nx = 120+Math.random()*160, ny = 120+Math.random()*160;
    el += '<circle cx="'+nx.toFixed(0)+'" cy="'+ny.toFixed(0)+'" r="45" fill="url(#glow)" opacity="0.5"/>';
    el += '<circle cx="'+nx.toFixed(0)+'" cy="'+ny.toFixed(0)+'" r="8" fill="'+p.accent+'" opacity="0.85"/>';
    return this._wrap(p, el, true);
  }

  _wrap(p, content, includeGlow) {
    var stops = p.colors.map(function(c, i, arr) {
      return '<stop offset="'+Math.round((i/(arr.length-1))*100)+'%" stop-color="'+c+'"/>';
    }).join('');
    var glow = includeGlow ? '<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="'+p.accent+'" stop-opacity="0.6"/><stop offset="50%" stop-color="'+p.accent+'" stop-opacity="0.15"/><stop offset="100%" stop-color="'+p.accent+'" stop-opacity="0"/></radialGradient>' : '';
    return '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'+stops+'</linearGradient>'+glow+'</defs><rect width="400" height="400" fill="url(#bg)"/>'+content+'</svg>';
  }

  _lerp(hex1, hex2, t) {
    var r1=parseInt(hex1.slice(1,3),16),g1=parseInt(hex1.slice(3,5),16),b1=parseInt(hex1.slice(5,7),16);
    var r2=parseInt(hex2.slice(1,3),16),g2=parseInt(hex2.slice(3,5),16),b2=parseInt(hex2.slice(5,7),16);
    return '#'+Math.round(r1+(r2-r1)*t).toString(16).padStart(2,'0')+Math.round(g1+(g2-g1)*t).toString(16).padStart(2,'0')+Math.round(b1+(b2-b1)*t).toString(16).padStart(2,'0');
  }

  minifySvg(svg) {
    return svg.replace(/\n\s*/g,'').replace(/\s{2,}/g,' ').replace(/([1-9]\d*)\.\d+/g,'$1');
  }

  randomPalette() {
    return this.palettes[Math.floor(Math.random()*this.palettes.length)];
  }

  async logArtCreation(svg, context) {
    var art = this.memoryManager.get('art');
    art.creations.push({ timestamp: new Date().toISOString(), context: context, svg_length: svg.length });
    art.total_pieces = art.creations.length;
    art.last_creation = new Date().toISOString();
    await this.memoryManager.save('art');
  }
}

module.exports = ArtGenerator;
