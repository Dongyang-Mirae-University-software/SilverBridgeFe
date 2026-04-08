import axios from 'axios';
import { ISignupReq } from '../interface/auth';
import { CommonResponse } from '../interface/common';

const AUTH_API_PATH = '/api';

export async function signup(body: ISignupReq) {
  const res = await axios.post<CommonResponse<null>>(`${AUTH_API_PATH}/register`, body).then(res => res.data);

  return res.data;
}

export default signup;
