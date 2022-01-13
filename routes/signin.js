const express = require('express')

const router = express.Router()
const samlp = require('samlp')
const { credentials, issuer, asyncParseRequest } = require('../core/constants')
const settings = require('../core/settings')
const Dingtalk = require('../core/repositories/dingtalk')
const Kintone = require('../core/repositories/kintone')
const PassportProfileMapper = require('../core/claims/passport_profile_mapper')

router.post('/', async (req, res, next) => {
  try {
    const data = await asyncParseRequest(req)
    const domain = new URL(data.issuer).host
    const tempcode = req.body.loginTmpCode
    const setting = await settings.get(domain)
    const dt = new Dingtalk(setting.appKey, setting.appSecret)
    const kt = new Kintone({ domain, appid: setting.appid, token: setting.token })
    const code = await dt.getLoginCode(tempcode, setting.callback)
    const unionid = await dt.getUnionid(code)

    const user = await dt.getUser(unionid)
    const loginName = await kt.getLoginName(user.mobile)

    req.user = { loginName }

    samlp.auth({
      issuer,
      cert: credentials.cert,
      key: credentials.key,
      getPostURL(wtrealm, wreply, _req, callback) {
        return callback(null, data.assertionConsumerServiceURL)
      },
      profileMapper: PassportProfileMapper,
      audience: data.issuer,
      recipient: data.assertionConsumerServiceURL,
    })(req, res, next)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    res.status(500).send('Invalid sso request')
  }
})

module.exports = router
