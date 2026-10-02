"""Real PostgreSQL concurrency checks with fictitious data on loopback only.
No connection to production, no saved credentials; leaves a diagnostic cluster.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import secrets
import socket
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT.parent / '.backup-tools/pgsql/bin'


def main():
    base = (ROOT/'output/isolated-db-tests').resolve()
    base.mkdir(parents=True, exist_ok=True)
    run = (base/uuid.uuid4().hex).resolve()
    if run.parent != base:
        raise RuntimeError('Invalid isolated directory')
    run.mkdir()
    password = secrets.token_urlsafe(32)
    password_file = run/'initial-password.txt'
    password_file.write_text(password, encoding='utf-8')
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    env = {**os.environ, 'PGHOST':'127.0.0.1', 'PGPORT':str(port), 'PGUSER':'postgres',
           'PGDATABASE':'postgres', 'PGPASSWORD':password, 'PGCONNECT_TIMEOUT':'5', 'PGSSLMODE':'disable'}
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    def command(args, sql=None):
        if args[0] == 'pg_ctl.exe':
            # The Windows server can inherit pipe handles from pg_ctl. Do not
            # wait for EOF from a long-lived server's inherited stdout handle.
            return subprocess.run([str(BIN/args[0]), *args[1:]], stdout=subprocess.DEVNULL,
                                  stderr=subprocess.DEVNULL, env=env, timeout=90, creationflags=flags)
        return subprocess.run([str(BIN/args[0]), *args[1:]], input=sql, text=True, encoding='utf-8',
                              capture_output=True, env=env, timeout=120, creationflags=flags)
    def query(sql):
        return command(['psql.exe','-X','-A','-t','-v','ON_ERROR_STOP=1'], sql)
    phase = 'initialize'
    started = False
    checks = []
    try:
        result = command(['initdb.exe','-D',str(run/'data'),'-U','postgres','--encoding=UTF8',
                          '--locale=C','--auth=scram-sha-256','--pwfile='+str(password_file)])
        password_file.unlink()
        if result.returncode:
            raise RuntimeError('initdb failed')
        phase = 'start_loopback'
        started = True
        result = command(['pg_ctl.exe','-D',str(run/'data'),'-l',str(run/'server.log'),
                          '-o',f'-h 127.0.0.1 -p {port} -c max_connections=12','-w','start'])
        if result.returncode:
            raise RuntimeError('PostgreSQL start failed')
        started = True
        phase = 'schema'
        bootstrap = """create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;
grant usage on schema auth to anon,authenticated;
"""
        sql = bootstrap + '\n'.join(p.read_text(encoding='utf-8-sig') for p in sorted((ROOT/'cloud').glob('0[0-9][0-9]_*.sql')))
        sql += (ROOT/'cloud/FINALIZAR_REGISTRO_SEGURO.sql').read_text(encoding='utf-8')
        result = query(sql)
        if result.returncode:
            (run/'schema-error.txt').write_text(result.stderr, encoding='utf-8')
            raise RuntimeError('Isolated schema failed')
        uid = lambda n: f'00000000-0000-4000-8000-{n:012d}'
        result = query(f"""insert into auth.users values('{uid(1)}','admin@invalid.test'),('{uid(2)}','student@invalid.test');
insert into user_roles values('{uid(1)}','admin'),('{uid(2)}','student');
insert into members(id,user_id,first_name,last_name,joined_at,status) values('{uid(10)}','{uid(2)}','Ficticio','Prueba',current_date,'Activo');
insert into routines(id,member_id,name,level,days_per_week,program_rounds,block_rounds) values('{uid(20)}','{uid(10)}','Test','Inicial',3,4,2);
insert into memberships(id,member_id,plan_name,months,starts_at,ends_at,price) values('{uid(40)}','{uid(10)}','Test',1,current_date,current_date+30,100);
""")
        if result.returncode:
            raise RuntimeError('Fixture failed')
        def as_user(n, statement):
            return f"begin;set local statement_timeout='10s';select set_config('request.jwt.claim.sub','{uid(n)}',true),set_config('request.jwt.claim.aal','aal2',true);set local role authenticated;{statement};commit;"
        def race(name, statements):
            nonlocal phase
            phase = name
            with ThreadPoolExecutor(max_workers=2) as pool:
                outcomes = list(pool.map(query, statements))
            if sum(r.returncode == 0 for r in outcomes) != 1:
                (run/(name+'-errors.txt')).write_text('\n'.join(r.stderr for r in outcomes), encoding='utf-8')
                raise RuntimeError('Race did not accept exactly one request')
            checks.append(name)
        lock = f"select pg_advisory_xact_lock(hashtext('{uid(10)}'),971045);select pg_sleep(0.3);"
        admin = f"select staff_register_session_checked(jsonb_build_object('id','{uid(30)}','member_id','{uid(10)}','routine_id','{uid(20)}','routine_name','Test','performed_at',(now() at time zone 'America/Montevideo')::date,'day',1,'week',1,'block',1,'notes','','results','[]'::jsonb),true,null)"
        student = f"select student_register_next_day_checked('{uid(31)}','{uid(20)}',(now() at time zone 'America/Montevideo')::date,'','[]',null,1,1)"
        race('simultaneous_staff_student_training', [as_user(1,lock+admin),as_user(2,student)])
        race('simultaneous_payments_cannot_exceed_balance',[
            as_user(1,f"select register_payment('{uid(n)}','{uid(10)}','{uid(40)}',current_date,6000,'Efectivo')") for n in [41,42]])
        race('simultaneous_room_booking_cannot_overlap',[
            as_user(1,f"select book_holistic_session('{uid(n)}','{uid(10)}','{kind}',current_date+2,'17:00')") for n,kind in [(51,'reiki'),(52,'akashic')]])
        phase = 'invariants'
        result = query('select (select count(*) from sessions)||\',\'||(select sum(amount)::int from payments)||\',\'||(select count(*) from room_appointments);')
        if result.returncode or result.stdout.strip() != '1,60,1':
            raise RuntimeError('Unexpected persisted totals')
        report = {'status':'passed','checks':checks,'realPostgreSQL':True,'productionTouched':False,'directory':str(run)}
    except Exception:
        report = {'status':'failed','phase':phase,'productionTouched':False,'directory':str(run)}
    finally:
        if started:
            stopped = command(['pg_ctl.exe','-D',str(run/'data'),'-m','fast','-w','stop'])
            if stopped.returncode:
                report = {'status':'failed','phase':'stop_local_server','directory':str(run)}
        env.pop('PGPASSWORD', None)
        if password_file.exists():
            password_file.unlink()
    (run/'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    (ROOT/'output/concurrency-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))
    return 0 if report['status']=='passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
