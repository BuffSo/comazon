import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { assert } from 'superstruct';
import cors from 'cors';
import {
  CreateUser,
  PatchUser,
  CreateProduct,
  PatchProduct,
  CreateOrder,
  PatchOrder,
  PostSavedProduct,
} from './structs.js';


const prisma = new PrismaClient();

const app = express();
app.use(express.json());

const corsOptions = {
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'https://buffso-pandamarket.netlify.app']
};
app.use(cors(corsOptions));

function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      if (
        e.name === 'StructError' ||
        e instanceof Prisma.PrismaClientValidationError
      ) {
        res.status(400).send({ message: e.message });
      } else if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        res.sendStatus(404);
      } else {
        res.status(500).send({ message: e.message });
      }
    }
  };
}

/*********** users ***********/

app.get('/users', asyncHandler(async (req, res) => {
  const { offset = 0, limit = 10, order = 'newest' } = req.query;
  let orderBy;
  switch (order) {
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
  }
  const users = await prisma.user.findMany({
    orderBy,
    skip: parseInt(offset),
    take: parseInt(limit),
    include: {
      userPreference: {
        select: {
          receiveEmail: true,
        }
      }
    },
    // select: {
    //   email: true,
    //   userPreference: {
    //     select: {
    //       receiveEmail: true,
    //     }
    //   },
    // },

  });
  res.send(users);
}));

app.get('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
  });
  res.send(user);
}));

app.get('/users/:id/saved-products', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { savedProducts } = await prisma.user.findUniqueOrThrow({
    where: { id }, 
    include: {
      savedProducts: true,
    }

  });
  res.send(savedProducts);
}));

app.post('/users/:id/saved-products', asyncHandler(async (req, res) => {
  assert(req.body, PostSavedProduct);
  const { id: userId } = req.params;
  const { productId } = req.body;
  // 찜 토글

  // 사용자가 찜했는지 확인
  const { savedProducts } = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      savedProducts: {
        where: { id: productId }
      }
    }
  });

  const action = savedProducts.length > 0 ? 'disconnect' : 'connect';

  // connect 또는 disconnect를 동적으로 설정
  // 변수명을 변경하여 충돌 방지
  const { savedProducts: updatedSavedProducts } = await prisma.user.update({
    where: { id: userId },
    data: {
      savedProducts: {
        [action]: { id: productId },
      },
    },
    include: {
      savedProducts: true,
    }
  });

  res.send(updatedSavedProducts);

  /*
  // 찜만하기
  const { savedProducts } = await prisma.user.update({
    where: { id: userId }, 
    data: {
      savedProducts: {
        connect: {
          id: productId,
        }
      }
    },
    include: {
      savedProducts: true,
    }

  });
  res.send(savedProducts);
  */
}));


app.get('/users/:id/orders', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { orders } = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: {
      orders: true,
    }
  });
  res.send(orders);
}));
/*
app.post('/users', asyncHandler(async (req, res) => {
  assert(req.body, CreateUser);
  const user = await prisma.user.create({
    data: req.body,
  });
  res.status(201).send(user);
}));
*/
app.post(
  '/users',
  asyncHandler(async (req, res) => {
    assert(req.body, CreateUser);
    const { userPreference, ...userFields } = req.body;
    const user = await prisma.user.create({
      data: {
        ...userFields,
        userPreference: {
          create: userPreference,
        },
      },
      include: {
        userPreference: true,
      },
    });
    res.status(201).send(user);
  })
);

/*
app.patch('/users/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchUser);
  const { id } = req.params;
  const user = await prisma.user.update({
    where: { id },
    data: req.body,
  });
  res.send(user);
}));
*/

app.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    assert(req.body, PatchUser);
    const { id } = req.params;
    const { userPreference, ...userFields } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...userFields,
        userPreference: {
          update: userPreference,
        },
      },
      include: {
        userPreference: true,
      },
    });
    res.send(user);
  })
);

app.delete('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.user.delete({
    where: { id },
  });
  res.sendStatus(204);
}));

/*********** products ***********/

app.get('/products', asyncHandler(async (req, res) => {
  const { offset = 0, limit = 10, order = 'newest', category } = req.query;
  let orderBy;
  switch (order) {
    case 'priceLowest':
      orderBy = { price: 'asc' };
      break;
    case 'priceHighest':
      orderBy = { price: 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'newest':
    default:
      orderBy = { createdAt: 'desc' };
  }
  const where = category ? { category } : {};
  const products = await prisma.product.findMany({
    where,
    orderBy,
    skip: parseInt(offset),
    take: parseInt(limit),
  });
  res.send(products);
}));

app.get('/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await prisma.product.findUnique({
    where: { id },
  });
  res.send(product);
}));

app.post('/products', asyncHandler(async (req, res) => {
  assert(req.body, CreateProduct);
  const product = await prisma.product.create({
    data: req.body,
  });
  res.status(201).send(product);
}));

app.patch('/products/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchProduct);
  const { id } = req.params;
  const product = await prisma.product.update({
    where: { id },
    data: req.body,
  });
  res.send(product);
}));

app.delete('/products/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.product.delete({
    where: { id },
  });
  res.sendStatus(204);
}));

/*********** orders ***********/

app.get('/orders', asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany();
  res.send(orders);
}));

app.get('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    include: {
      orderItems: true,
    }
  });
  // reduce로 바꿔보기
  let total = 0;
  order.orderItems.forEach((orderItem) => {
    total += orderItem.unitPrice * orderItem.quantity;
  });
  order.total = total;
  res.send(order);
}));




// 주문 생성 PromisAll, transaction
app.post('/orders', asyncHandler(async (req, res) => {
  assert(req.body, CreateOrder);
  const { userId, orderItems } = req.body;
  const productIds = orderItems.map((orderItem) => orderItem.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  // helper 함수 // JS에서는 함수안에 함수 선언이 가능하다
  function getQuantity(productId) {
    const orderItem = orderItems.find((orderItem) => orderItem.productId == productId)
    return orderItem.quantity;
  }
  
  //재고 확인
  const isSufficientStock = products.every((product) => {
    const { id, stock } = product;
    return stock >= getQuantity(id);
  });

  if(!isSufficientStock) {
    throw new Error('Insufficient Stock');
  }
/*
  const order = await prisma.order.create({
    data: {
      userId,
      orderItems: {
        create: orderItems,
      },
    },
    include: {
      orderItems: true,
    },
  });
*/  
  const queryPromises = productIds.map(
    (productId) => 
    prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          decrement: getQuantity(productId),
        },
      },
    }) // Promise 메소드 호출 결과 반환값
  );

  // 트랜잭션 : 실행할 쿼리들을 배열형태로 전달 : 배열에 promise 를 넣어준다.
  // $transaction 은 Promise all 과 비슷하며 배열을 리턴한다.
  const [order] = await prisma.$transaction([
    prisma.order.create({
      data: {
        userId,
        orderItems: {
          create: orderItems,
        },
      },
      include: {
        orderItems: true,
      },
    }),
    ...queryPromises,    
  ]);

  //await Promise.all(queryPromises);
  
  res.status(201).send(order);
}));

app.patch('/orders/:id', asyncHandler(async (req, res) => {
  assert(req.body, PatchOrder);
  const { id } = req.params;
  const order = await prisma.order.update({
    where: { id },
    data: req.body,
  });
  res.send(order);
}));

app.delete('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.order.delete({ where: { id } });
  res.sendStatus(204);
}));


app.listen(process.env.PORT || 3000, () => console.log('Server Started'));
