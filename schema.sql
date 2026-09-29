create table if not exists users(
 id serial primary key,
 name varchar(120) not null,
 phone varchar(40) unique not null,
 password_hash text not null,
 created_at timestamptz default now()
);
create table if not exists messages(
 id bigserial primary key,
 sender_id integer not null references users(id) on delete cascade,
 receiver_id integer not null references users(id) on delete cascade,
 body text not null,
 created_at timestamptz default now()
);
create index if not exists messages_pair_idx on messages(sender_id,receiver_id,created_at);