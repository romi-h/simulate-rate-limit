const assert = require('assert');
const express = require('express');
const cbw = require('cbw');
const _ = require('lodash');

const router = express.Router();

const getUser = (username, cb) => {
  cb(null, {
    id: username,
  });
};

const authCheckerBasic = (req, res, next) => {
  if (!req.headers?.authorization) {
    return res.sendStatus(401);
  }
  //console.log(req.headers['authorization']);
  const encodedPair = req.headers['authorization'].split('Basic ').pop();
  const [username, password] = Buffer.from(encodedPair, 'base64').toString('utf8').split(':', 2);

  return getUser(
    username,
    cbw(next)((user) => {
      if (!user) return res.sendStatus(401);

      if (password === 'master-key') {
        req.session = { id: user.id};
        return next();
      }

      res.sendStatus(401);
    })
  );
};


/**
 * Middleware for checking authentication.
 * Is does nothing about access control. If you need to control
 * access - check `router.allow` middleware instead.
 *
 *  - it works either with JWT
 *  - or with Basic Auth (non production env only)
 */
router.check = (req, res, next) => {
  return authCheckerBasic(req, res, next);
};

/**
 * Middleware for controlling access for resources. It works with
 * already established session from `router.check`. It accepts session
 * with any of supplied roles (sub claims).
 *
 * Feel free to extend it if you need more logic around ACL.
 */
router.allow = (roles) => {
  roles = Array.isArray(roles) ? roles : [roles];
  assert(
    roles.every((r) => _.includes(_.values(JWT_SUBJECTS), r)),
    `Invalid role for auth checker: ${roles}`
  );

  return [
    (req, res, next) => {
      assert(req.session.sub, 'Token "sub" claim should be defined');
      if (!req.session.jti && !_.includes(roles, req.session.sub)) {
        return res
          .status(403)
          .send({ message: 'Scope of current JWT token does not allow you to access requested resource' });
      }

      if (req.session.jti) {
        assert(req.session.userId, 'Token "userId" should be defined');
        return tables.user.get(
          req.session.userId,
          cbw(next)((user) => {
            if (!_.find(_.get(user, 'tokens'), { id: req.session.jti })) {
              return res.status(403).send({ message: 'Invalid token' });
            }

            if (!_.includes(roles, JWT_SUBJECTS.ORGANISATION)) {
              return res
                .status(403)
                .send({ message: 'Scope of current JWT token does not allow you to access requested resource' });
            }

            req.session.orgId = user.orgId;
            next();
          })
        );
      }

      next();
    },
    router.logTokenUsageMw,
  ];
};

router.logTokenUsageMw = (req, res, next) => {
  const { apiTokenLogged, ip, session, originalUrl } = req;
  if (apiTokenLogged || !session.jti) return next();

  const url = new URL(originalUrl, `http://localhost:5000}`);
  const metadata = {
    userId: session.userId,
    orgId: session.orgId,
    tokenId: session.jti,
    url: url.pathname,
    query: url.search,
    ip,
  };
  console.log({metadata}, 'logging API Token used');

  req.apiTokenLogged = true;
  next();
};

module.exports = router;
