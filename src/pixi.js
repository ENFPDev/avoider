import React, { Component } from 'react';
import * as Pixi from 'pixi.js';
import spaceshipSrc from '../../assets/spaceship.png';
import bitcoinImg from '../../assets/bitcoin.png';
import cardano from '../../assets/cardano.png';
import ether from '../../assets/ether.png';
import nosImg from '../../assets/nos.png';
import explosionJson from '../../assets/explosion.json';
import explosionImg from '../../assets/spritesheet.png';
import backgroundImg from '../../assets/background.jpg';
import gameoverImg from '../../assets/gameover.jpg';

import injectSheet from 'react-jss';
import PropTypes from 'prop-types';
import { react } from '@nosplatform/api-functions';
// import { u, wallet } from '@cityofzion/neon-js';
// import { unhexlify } from 'binascii';
import {
  str2hexstring,
  int2hex,
  hexstring2str
} from '@cityofzion/neon-js/src/utils';

const { injectNOS, nosProps } = react.default;

const styles = {
  button: {
    margin: '16px',
    fontSize: '14px'
  }
};

// const bullets = [bullet1, bullet2, bullet3, bullet4];
const bulletTypes = [];

let newSprite = PIXI.Sprite.fromImage(bitcoinImg);
bulletTypes.push({
  name: 'bitcoin',
  sprite: newSprite,
  speed: 1.1,
  radius: Math.sqrt(32 * 32) // 64 / 2
});

newSprite = PIXI.Sprite.fromImage(cardano);
bulletTypes.push({
  name: 'cardano',
  sprite: newSprite,
  speed: 4.7,
  radius: Math.sqrt(12 * 12) // 24 / 2
});

newSprite = PIXI.Sprite.fromImage(ether);
bulletTypes.push({
  name: 'ether',
  sprite: newSprite,
  speed: 2.2,
  radius: Math.sqrt(21 * 21) // 42 / 2
});

const bulletTypeCnt = bulletTypes.length;

const style = new PIXI.TextStyle({
  fontFamily: 'Arial',
  fontSize: 28,
  fontStyle: 'italic',
  fontWeight: 'bold',
  fill: ['#ffffff', '#00ff99'], // gradient
  stroke: '#4a1850',
  strokeThickness: 5,
  dropShadow: true,
  dropShadowColor: '#000000',
  dropShadowBlur: 4,
  dropShadowAngle: Math.PI / 6,
  dropShadowDistance: 6,
  wordWrap: true,
  wordWrapWidth: 800
});

var pkeys = [];
window.onkeydown = function(e) {
  var code = e.keyCode ? e.keyCode : e.which;
  pkeys[code] = true;
};
window.onkeyup = function(e) {
  var code = e.keyCode ? e.keyCode : e.which;
  pkeys[code] = false;
};

const moveSpeed = 6;
const stirSpeed = 0.07;
const boostSpeed = 20;
const levelUpBound = 300;

let randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

let shieldMaxGuage = 100;
let shieldGuage = 30;
let score = 0;
let level = 1;
let shieldRadius = Math.sqrt(30 * 30); // 60 / 2
const gameViewWidth = 1200;
const gameViewHeight = 800;
let noHitTime = 30; // 60 tick 1000ms 0.5
let deltaAfterHit = 0;
let blinkingFrq = 5;
let blinking = false;
let shieldExist = true;
let gameOver = false;
let gameStarted = false;
let init = true;
let userAccount = '';
let coinInserted = false;
let topScore = null;
let topScoreUser = null;
let reward = null;
// Smart Contract Related
const scriptHash = '443bff3e184bae170996b55e2b2853868b983ded';
const invokeInsertCoin = {
  scriptHash,
  operation: 'insertcoin',
  args: [] // user
}; // and testInvoke Insert

let invokeGameover = {
  scriptHash,
  operation: 'gameover',
  args: [] // user, score
};

let invokeGetTopScore = {
  scriptHash,
  operation: 'gettopscore',
  args: [] // user, score
};

let invokeTest = {
  scriptHash,
  operation: 'test',
  args: []
};

let invokeGetTopScoreUser = {
  scriptHash,
  operation: 'gettopscoreuser',
  args: [] // user, score
};

let byteArray = [];

class PixiComponent extends Component {
  constructor() {
    super();
    this.app = new Pixi.Application(gameViewWidth, gameViewHeight);
    this.state = {
      player: {},
      stat: {},
      scoreBoard: null,
      levelBar: null,
      startGameBoard: null
    };
  }
  initialize = async () => {
    await this.contractGetAddress();
    if (userAccount) {
      await this.contractInsertCoin();
    }
    // this.app = PIXI.autoDetectRenderer(800, 600,{backgroundColor : 0x1099bb});
    this.gameCanvas.appendChild(this.app.view);

    // create a new Sprite from an image path
    const background = PIXI.Sprite.fromImage(backgroundImg);
    this.app.stage.addChild(background);
    let baseTexture = PIXI.BaseTexture.fromImage(explosionImg);
    let spritesheet = new PIXI.Spritesheet(baseTexture, explosionJson);
    // parse the object data and the base texture to create textures for each frame
    spritesheet.parse(() => {
      let textures = Object.keys(spritesheet.textures).map(
        t => spritesheet.textures[t]
      );

      // create the animated sprite
      this.explosionSprite = new PIXI.extras.AnimatedSprite(textures);
      this.explosionSprite.anchor.set(0.5);
      // slow down the anim speed a bit, and play the animation
      this.explosionSprite.animationSpeed = 1;
      this.explosionSprite.play();
    });
    // center the sprite's anchor point
    this.player = PIXI.Sprite.fromImage(spaceshipSrc);
    this.player.anchor.set(0.5);
    this.player.scale.x = 0.1;
    this.player.scale.y = 0.1;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.x = this.app.screen.width / 2;
    this.player.y = this.app.screen.height / 2;
    this.app.stage.addChild(this.player);

    this.shield = PIXI.Sprite.fromImage(nosImg);
    this.shield.anchor.set(0.5);
    this.shield.scale.x = 0.15;
    this.shield.scale.y = 0.15;
    this.shield.vx = 0;
    this.shield.vy = 0;
    this.shield.x = this.app.screen.width / 2;
    this.shield.y = this.app.screen.height / 2;
    this.app.stage.addChild(this.shield);

    let yShift = 0;
    if (userAccount) {
      this.userName = new PIXI.Text('User :' + userAccount, style);
      this.userName.x = 0;
      this.userName.y = yShift;
      this.app.stage.addChild(this.userName);
      yShift += 28;
    }

    this.scoreBoard = new PIXI.Text('Score :', style);
    this.scoreBoard.x = 0;
    this.scoreBoard.y = yShift;
    this.app.stage.addChild(this.scoreBoard);
    yShift += 28;

    this.shieldGuageBar = new PIXI.Text(
      'Shield :' + shieldGuage.toString(),
      style
    );
    this.shieldGuageBar.x = 0;
    this.shieldGuageBar.y = yShift;
    this.app.stage.addChild(this.shieldGuageBar);
    yShift += 28;

    this.levelText = new PIXI.Text('Level :' + level.toString(), style);
    this.levelText.x = 0;
    this.levelText.y = yShift;
    this.app.stage.addChild(this.levelText);
    yShift += 28;

    this.contractGetTopScore();
    if (topScore) {
      this.recordScore = new PIXI.Text(
        'Top Score :' + topScore.toString(),
        style
      );
    } else {
      this.recordScore = new PIXI.Text('Top Score : 0', style);
    }

    this.recordScore.x = 0;
    this.recordScore.y = yShift;
    this.app.stage.addChild(this.recordScore);
    yShift += 28;

    this.contractGetTopScoreUser();
    if (topScoreUser) {
      this.recordScoreUser = new PIXI.Text(
        'Top Score User :' + topScoreUser.toString(),
        style
      );
    } else {
      this.recordScoreUser = new PIXI.Text('Top Score User : None', style);
    }
    this.recordScoreUser.x = 0;
    this.recordScoreUser.y = yShift;
    this.app.stage.addChild(this.recordScoreUser);
    yShift += 28;

    this.startGameBoard = new PIXI.Text('Enter Any Button To Start', style);
    this.startGameBoard.anchor.set(0.5);
    this.startGameBoard.x = gameViewWidth / 2;
    this.startGameBoard.y = gameViewHeight / 2;
    this.app.stage.addChild(this.startGameBoard);

    this.stat = this.play;
    this.app.stage.interactive = true;

    this.app.ticker.add(delta => {
      this.gameLoop(delta);
      // just for fun, let's rotate mr rabbit a little
      // delta is 1 if running at 100% performance
      // creates frame-independent transformation
      // player.rotation += 0.1 * delta;
    });
    this.app.start();
  };
  play = delta => {
    //Use the cat's velocity to make it move
    this.player.x += this.player.vx;
    this.player.y += this.player.vy;
  };
  keyboard = keyCode => {
    let key = {};
    key.code = keyCode;
    key.isDown = false;
    key.isUp = true;
    key.press = undefined;
    key.release = undefined;
    //The `downHandler`
    key.downHandler = event => {
      if (event.keyCode === key.code) {
        if (key.isUp && key.press) key.press();
        key.isDown = true;
        key.isUp = false;
      }
      event.preventDefault();
    };

    //The `upHandler`
    key.upHandler = event => {
      if (event.keyCode === key.code) {
        if (key.isDown && key.release) key.release();
        key.isDown = false;
        key.isUp = true;
      }
      event.preventDefault();
    };

    //Attach event listeners
    window.addEventListener('keydown', key.downHandler.bind(key), false);
    window.addEventListener('keyup', key.upHandler.bind(key), false);
    return key;
  };
  rotateToPoint = (mx, my, px, py) => {
    var self = this;
    var dist_Y = my - py;
    var dist_X = mx - px;
    var angle = Math.atan2(dist_Y, dist_X);
    //var degrees = angle * 180/ Math.PI;
    return angle;
  };
  isGameOver = () => {
    if (gameOver === false) return;
    const background = PIXI.Sprite.fromImage(gameoverImg);
    this.app.stage.addChild(background);

    const GameOverBoard = new PIXI.Text('Game Over', style);
    GameOverBoard.anchor.set(0.5);
    GameOverBoard.x = gameViewWidth / 2;
    GameOverBoard.y = gameViewHeight / 2;
    this.app.stage.addChild(GameOverBoard);

    const finalScore = new PIXI.Text('Score :' + score.toString(), style);
    finalScore.anchor.set(0.5);
    finalScore.x = gameViewWidth / 2;
    finalScore.y = gameViewHeight / 2 + 28;
    this.app.stage.addChild(finalScore);

    this.contractGameOver(score);
    this.app.ticker.stop();
  };
  createBullet = () => {
    // let cnt = Math.floor(Math.random() * this.bulletCnt + 1);
    let cnt = 30;
    let createPosX = 0;
    let createPosY = 0;
    let angle = 0;
    // let angle = Math.atan2(Math.abs(createPosX - 700), Math.abs(createPosY - 500));
    let bullets = [];
    for (let index = 0; index < cnt; index++) {
      let dim = randomInt(0, 3);
      if (dim < 2) {
        // Top & Bottom
        createPosX = randomInt(0, gameViewWidth);
        if (dim === 0) {
          // Top
          createPosY = 0;
          angle = randomInt(-180, 0);
        } else {
          createPosY = gameViewHeight;
          angle = randomInt(0, 180);
        }
      } else {
        // Left & Right
        createPosY = randomInt(0, gameViewHeight);
        if (dim === 2) {
          // Right
          createPosX = 0;
          angle = randomInt(-270, -90);
        } else {
          createPosX = gameViewWidth;
          angle = randomInt(-90, 90);
        }
      }

      let bulletType = Math.floor(Math.random() * bulletTypeCnt); // 0 B1 / 1 B2 / 2 B3 / 3 B4
      let bulletSpeed = bulletTypes[bulletType].speed;
      let bullet = new PIXI.Sprite(bulletTypes[bulletType].sprite.texture);
      bullet.anchor.set(0.5);
      bullet.x = createPosX;
      bullet.y = createPosY;
      bullet.speedX = Math.cos(angle) * bulletSpeed;
      bullet.speedY = Math.sin(angle) * bulletSpeed;
      bullets.push({
        bullet: bullet,
        radius: bulletTypes[bulletType].radius,
        name: bulletTypes[bulletType].name
      });
      this.app.stage.addChild(bullet);
    }

    this.bullets = bullets;
  };
  boxesIntersect = (a, b) => {
    var ab = a.getBounds();
    var bb = b.getBounds();
    return (
      ab.x + ab.width > bb.x &&
      ab.x < bb.x + bb.width &&
      ab.y + ab.height > bb.y &&
      ab.y < bb.y + bb.height
    );
  };
  cricleIntersect = (player, shieldRadius, bullet, bulletRadius) => {
    let a =
      (bullet.position.x - player.position.x) *
        (bullet.position.x - player.position.x) +
      (bullet.position.y - player.position.y) *
        (bullet.position.y - player.position.y);
    let b = (bulletRadius + shieldRadius) * (bulletRadius + shieldRadius);
    if (b > a) {
      // console.log("a:" + shieldRadius);
      // console.log("b:" + bulletRadius);
      return true;
    }
    return false;
  };
  startGame = async () => {
    if (init) {
      this.app.stage.removeChild(this.startGameBoard);
      this.createBullet();
      init = false;
    }
  };
  gameLoop = delta => {
    if (gameStarted === false) {
      if (pkeys[32] && coinInserted) gameStarted = true;
      return;
    } else {
      this.startGame();
    }

    if (this.isGameOver()) return;

    //Update the current game state:
    this.stat(delta);
    // this.player.rotation = this.rotateToPoint(
    //   this.app.renderer.plugins.interaction.mouse.global.x,
    //   this.app.renderer.plugins.interaction.mouse.global.y,
    //   this.player.position.x,
    //   this.player.position.y
    // );
    let maxX = this.app.view.width;
    let maxY = this.app.view.height;

    if (this.bullets) {
      for (let index = 0; index < this.bullets.length; index++) {
        const element = this.bullets[index].bullet;

        element.position.x += element.speedX;
        element.position.y += element.speedY;

        if (element.position.x > maxX) {
          element.speedX *= -1;
          element.position.x = maxX;
        } else if (element.position.x < 0) {
          element.speedX *= -1;
          element.position.x = 0;
        }

        if (element.position.y > maxY) {
          element.speedY *= -1;
          element.position.y = maxY;
        } else if (element.position.y < 0) {
          element.speedY *= -1;
          element.position.y = 0;
        }
      }
    }

    this.shield.rotation += 0.5;

    if (pkeys[87]) {
      //W key
      let nextX =
        this.player.position.x +
        Math.cos(this.player.rotation - Math.PI / 2) * moveSpeed;
      let nextY =
        this.player.position.y +
        Math.sin(this.player.rotation - Math.PI / 2) * moveSpeed;

      if (nextX < maxX && nextX > 0) {
        this.shield.position.x = this.player.position.x = nextX;
      }
      if (nextY < maxY && nextY > 0) {
        this.shield.position.y = this.player.position.y = nextY;
      }
    }
    if (pkeys[83]) {
      //S key
      let nextX = (this.shield.position.x =
        this.player.position.x +
        Math.cos(this.player.rotation - Math.PI / 2) * -moveSpeed);
      let nextY =
        this.player.position.y +
        Math.sin(this.player.rotation - Math.PI / 2) * -moveSpeed;

      if (nextX < maxX && nextX > 0) {
        this.shield.position.x = this.player.position.x = nextX;
      }
      if (nextY < maxY && nextY > 0) {
        this.shield.position.y = this.player.position.y = nextY;
      }
    }
    if (pkeys[68]) {
      //a key
      this.player.rotation += stirSpeed;
    }
    if (pkeys[65]) {
      //d key
      this.player.rotation -= stirSpeed;
    }
    if (pkeys[32]) {
      if (shieldGuage >= shieldMaxGuage) shieldGuage = shieldMaxGuage;
      else {
        if (shieldExist) shieldGuage += 0.5;
      }
      // boost
      let nextX =
        this.player.position.x +
        Math.cos(this.player.rotation - Math.PI / 2) * boostSpeed;
      let nextY =
        this.player.position.y +
        Math.sin(this.player.rotation - Math.PI / 2) * boostSpeed;

      if (nextX < maxX && nextX > 0) {
        this.shield.position.x = this.player.position.x = nextX;
      }
      if (nextY < maxY && nextY > 0) {
        this.shield.position.y = this.player.position.y = nextY;
      }
    }

    this.explosionSprite.position = this.player.position;

    if (deltaAfterHit === 0) {
      if (this.bullets) {
        for (let index = 0; index < this.bullets.length; index++) {
          const element = this.bullets[index];
          if (
            this.cricleIntersect(
              this.player,
              shieldRadius,
              element.bullet,
              element.radius
            )
          ) {
            // console.log("hit");
            deltaAfterHit++;

            if (shieldGuage === 0 && shieldExist === false) {
              this.app.stage.addChild(this.explosionSprite);
              this.app.stage.removeChild(this.player);
              // console.log("Game Over");
              gameOver = true;
            } else {
              if (element.name === 'bitcoin') shieldGuage -= 50;
              else if (element.name === 'ether') shieldGuage -= 30;
              else if (element.name === 'cardano') shieldGuage -= 5;

              if (shieldGuage <= 0) {
                shieldGuage = 0;
                shieldExist = false;
                this.app.stage.removeChild(this.shield);
              }
            }
          }
        }
      }
    } else {
      deltaAfterHit++;
      if (deltaAfterHit % blinkingFrq === 0) {
        blinking = !blinking;
      }

      if (blinking) {
        this.player.alpha = 0.2;
        this.shield.alpha = 0.2;
      } else {
        this.player.alpha = 1;
        this.shield.alpha = 1;
      }

      if (deltaAfterHit > noHitTime) {
        deltaAfterHit = 0;
        this.player.alpha = 1;
        this.shield.alpha = 1;
        // console.log("reset");
      }
    }

    // Status
    score += 1;
    this.shieldGuageBar.text = 'NOS Guage :' + shieldGuage.toString();
    this.scoreBoard.text = 'Score : ' + score.toString();
    this.levelText.text = 'Level : ' + level.toString();
    if (score > level * levelUpBound) {
      level++;
      if (this.bullets) {
        for (let index = 0; index < this.bullets.length; index++) {
          const element = this.bullets[index].bullet;
          element.speedX *= 1.05;
          element.speedY *= 1.05;
        }
      }
    }
  };
  componentWillUnmount() {
    this.app.stop();
  }
  componentDidMount() {
    this.initialize();
  }
  componentWillMount() {}
  contractGetAddress = async () => {
    console.log('contractGetAddress');
    await this.props.nos.getAddress().then(data => {
      userAccount = data;
    });
  };
  contractInsertCoin = async () => {
    debugger;
    console.log('contractInsertCoin');
    this.props.nos.getAddress();
    if (userAccount) {
      invokeInsertCoin.args[0] = userAccount;
      try {
        await this.props.nos.invoke(invokeInsertCoin);
        coinInserted = true;
      } catch (e) {
        console.log(e);
        return;
      }
    }
  };
  contractGameOver = async finalScore => {
    console.log('contractGameOver');
    if (userAccount) {
      invokeGameover.args[0] = userAccount;
      invokeGameover.args[1] = finalScore;
      try {
        await this.props.nos.invoke(invokeGameover);
      } catch (e) {
        console.log(e);
        return;
      }
    }
  };
  testContract = async () => {
    this.props.nos.testInvoke(invokeTest).then(data => {
      console.log(JSON.stringify(data));
    });
  };
  contractGetTopScore = async () => {
    console.log('contractGetTopScore');
    this.props.nos.testInvoke(invokeGetTopScore).then(data => {
      console.log(JSON.stringify(data));
    });
    // this.props.nos
    //   .getStorage({ scriptHash, key: 'topscore', encodeInput:false, decodeOutput:false})
    //   .then(data => console.log(JSON.stringify(data)))
    //   .catch(err => alert(`Error: ${err.message}`));
  };
  contractGetTopScoreUser = async () => {
    // console.log("contractGetTopScoreUser");
    // this.props.nos.testInvoke(invokeGetTopScoreUser).then(data => {
    //   console.log(JSON.stringify(data));
    // });
    this.props.nos
      .getStorage({ scriptHash, key: str2hexstring('topscoreuser') })
      .then(data => console.log(JSON.stringify(data)))
      .catch(err => console.log(`Error: ${err.message}`));
  };
  deserialize = rawData => {
    // Split into bytes of 2 characters
    const rawSplitted = rawData.match(/.{2}/g);

    // The size of the length of your array.
    // It's in hex so the length is max 255.
    const collectionLenLen = parseInt(rawSplitted[0], 16);
    let offset = collectionLenLen + 1; // offset is malleable

    // Get the amount of elements in your array.
    const collectionLen = parseInt(concatBytes(rawSplitted, 1, offset), 16);

    const rawArray = [];

    for (let i = 0; i < collectionLen; i += 1) {
      const incOffset = offset + 1;
      // The size of the length of your item.
      // It's in hex so the length is max 255.
      const itemLenLen = parseInt(
        concatBytes(rawSplitted, offset, incOffset),
        16
      );
      const offsetItemLenLen = incOffset + itemLenLen;

      // Get the length of your item
      const itemLen = parseInt(
        concatBytes(rawSplitted, incOffset, offsetItemLenLen),
        16
      );
      const offsetItemLen = offsetItemLenLen + itemLen;

      // Store to rawArray
      rawArray.push(concatBytes(rawSplitted, offsetItemLenLen, offsetItemLen));

      // Abuse malleable offset
      offset = offsetItemLen;
    }

    return rawArray;
  };
  render() {
    let component = this;
    return (
      <div
        ref={thisDiv => {
          component.gameCanvas = thisDiv;
        }}
      />
    );
  }
}

PixiComponent.propTypes = {
  classes: PropTypes.objectOf(PropTypes.any).isRequired,
  nos: nosProps.isRequired
};

export default injectNOS(injectSheet(styles)(PixiComponent));
