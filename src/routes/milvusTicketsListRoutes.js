import { Router } from 'express';
import milvusticketscontroller from '../controllers/MilvusTicketsListController';
const router = new Router();


router.post('/', milvusticketscontroller.store);

export default router;
