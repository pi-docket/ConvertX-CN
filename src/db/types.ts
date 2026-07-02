export class Filename {
  id!: number;
  job_id!: number;
  file_name!: string;
  output_file_name!: string;
  status!: string;
  error_message!: string | null;
  started_at!: string | null;
  completed_at!: string | null;
}

export class Jobs {
  finished_files!: number;
  id!: number;
  user_id!: number;
  date_created!: string;
  status!: string;
  error_message!: string | null;
  started_at!: string | null;
  completed_at!: string | null;
  num_files!: number;
  files_detailed!: Filename[];
}

export class User {
  id!: number;
  email!: string;
  password!: string;
}

export class ApiKey {
  id!: number;
  user_id!: number;
  key_name!: string;
  key_value!: string;
  created_at!: string;
  updated_at!: string;
}
