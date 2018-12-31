#!/usr/bin/python2.7
import MySQLdb
import config
import argparse
import os
import errno
import re
import hashlib

class ThatsVeryNAS:
    def __init__(self, config):
        self.db = MySQLdb.connect(host=config.dbhost,      # your host, usually localhost
                     user=config.dbuser,      # your username
                     passwd=config.dbpass,    # your password
                     db=config.dbname)        # name of the data base
        self.dbc = self.db.cursor()
        self.addpath_stored="INSERT INTO paths (path) VALUES (%s)"
        self.getpath_stored="SELECT * FROM paths WHERE path=%s"
        self.addpattern_stored="INSERT INTO exclusions (pattern,path_id) VALUES (%s,%s)"
        self.getpattern_stored="SELECT * FROM exclusions WHERE pattern=%s AND path_id=%s"

    def IsDBInstalled(self):
        # find the main table to see if DB was set up
        self.dbc.execute("SHOW TABLES LIKE 'files'")
        if (self.dbc.rowcount > 0):
            return True
        else:
            return False

    def PathExists(self,path):
        self.dbc.execute(self.getpath_stored, {path})
        if (self.dbc.rowcount > 0):
            row=self.dbc.fetchone()
            path_id=row[0];
            return int(path_id)
        else:
            return False

    def AddPath(self,path):
        path_id=self.PathExists(path);
        if (path_id==0):
            self.dbc.execute(self.addpath_stored, {path})
            self.db.commit()
            path_id=self.dbc.lastrowid
        return path_id;

    def ExclusionPatternExists(self,pattern,path_id):
        self.dbc.execute(self.getpattern_stored, (pattern,path_id))
        if (self.dbc.rowcount > 0):
            return True
        else:
            return False

    def AddExclusionPattern(self,pattern,path_id):
        if (self.ExclusionPatternExists(pattern,path_id) == False):
            self.dbc.execute(self.addpattern_stored, (pattern,path_id))
            self.db.commit()

    def AddFile(self, path_id, filename, full_filename):
        BLOCKSIZE = 65536
        hasher = hashlib.sha256()
        with open(full_filename, 'rb') as afile:
            buf = afile.read(BLOCKSIZE)
            while len(buf) > 0:
                hasher.update(buf)
                buf = afile.read(BLOCKSIZE)
        file_hash = hasher.hexdigest()

        if (config.updatefilelog):
            fupdated = open(config.updatefilelog, 'a')

        # If the filename exists but the file hash is different we need
        # to change the status on it to indicate the file exists but as a
        # different hash
        self.dbc.execute("""SELECT HEX(file_hash) FROM files
                WHERE path_id=%s AND filename=%s AND file_hash!=UNHEX(%s)""",
                (path_id, filename, file_hash))
        if (self.dbc.rowcount > 0):
            row=self.dbc.fetchone()
            if (fupdated):
                fupdated.write("UPDATING file: %s (%s != %s)\n" %(filename,
                    file_hash, row[0]))
            self.dbc.execute("""UPDATE files SET status='UPDATED' WHERE
                    file_hash=UNHEX(%s)""", {row[0]})

        # Insert the file. if the hash exists, update path and filename just in
        # case it moved
        self.dbc.execute("""INSERT INTO files
                SET file_hash=UNHEX(%s), path_id=%s, filename=%s
                ON DUPLICATE KEY UPDATE path_id=%s, filename=%s""",
                (file_hash, path_id, filename, path_id, filename))
        self.db.commit()

    def ScanPath(self,path_id):
        # open a log file for skipped files if configured
        if (config.skipfilelog):
            if not os.path.exists(os.path.dirname(config.skipfilelog)):
                try:
                    os.makedirs(os.path.dirname(config.skipfilelog))
                except OSError as exc: # Guard against race condition
                    if exc.errno != errno.EEXIST:
                        raise

            fskipped = open(config.skipfilelog, 'a')

        # Get given path or all paths
        if (path_id>0):
            self.dbc.execute("SELECT path FROM paths WHERE path_id=%s",(path_id))
        else:
            self.dbc.execute("SELECT path_id,path FROM paths")
        paths=self.dbc.fetchall()
        for path_id,path in paths:
            print("%s, %s" %(path_id, path))
            # Get exclusions for the path as well as exclusions for all paths
            self.dbc.execute("SELECT pattern FROM exclusions WHERE path_id IN (0,%s)", {path_id})
            patterns=self.dbc.fetchall()

            for root, dirs, files in os.walk(path):
                for file in files:
                    skip=False
                    full_filename=os.path.join(root, file)
                    rel_filename=full_filename[len(path):]
                    for pattern in patterns:
                        if (re.match("%s" %(pattern), "%s" %(rel_filename)) != None):
                            skip=True
                            break
                    if (skip==False):
                        self.AddFile(path_id, rel_filename, full_filename)
                    elif (fskipped):
                        fskipped.write("Skipping: %s\n" %full_filename)

    def PrintInfo(self):
        self.dbc.execute("""SELECT
                p.path,GROUP_CONCAT(DISTINCT e.pattern),COUNT(f.file_hash)
                FROM paths p
                LEFT JOIN exclusions e ON e.path_id=p.path_id
                LEFT JOIN files f ON f.path_id=p.path_id
                GROUP BY p.path_id""")
        data = self.dbc.fetchall()
        for row in data :
            print("%s\n%s\n%s" %(row[0], row[1], row[2]))

    def __del__(self):
        self.dbc.close()
        self.db.close()

#
# Main execution
#
if __name__ == '__main__':
    nas = ThatsVeryNAS(config)

    parser = argparse.ArgumentParser(description='Manage your nice NAS.')
    parser.add_argument('--info', '-i', action="store_true", help='Displays info on config and files')
    parser.add_argument('--addpath', '-p', action="store_true", help='adds a path to look for files')
    parser.add_argument('--addexclusion_pattern', '-e',
    action="store_true",help='adds an exlusion to ignore when scanning all paths')
    parser.add_argument('--scan', '-s', action="store_true", help='Scan path(s) and index file')

    args = parser.parse_args()

    path_id=0
    if (args.addpath):
        print("Enter path:")
        addpath=raw_input()
        path_id=nas.AddPath(addpath)
        if (path_id>0):
            print("Path is ID: %d" %path_id)

    if (args.addexclusion_pattern):
        print("Enter exclusion for %d (regex):" %path_id)
        addexclusion = raw_input();
        nas.AddExclusionPattern(addexclusion,path_id)

    if (args.scan):
        nas.ScanPath(path_id)

    if (args.info):
        nas.PrintInfo()
