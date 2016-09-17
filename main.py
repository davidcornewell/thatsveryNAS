#!/usr/bin/python
import MySQLdb
import config
import argparse

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

    def PrintInfo(self):
        self.dbc.execute("""SELECT
                p.path,GROUP_CONCAT(e.pattern),COUNT(f.file_hash)
                FROM paths p
                LEFT JOIN exclusions e ON e.path_id=p.path_id
                LEFT JOIN files f ON f.path_id=p.path_id
                GROUP BY p.path_id""")
        data = self.dbc.fetchall()
        for row in data :
            print "%s\n%s\n%s" %(row[0], row[1], row[2])

    def __del__(self):
        self.dbc.close()
        self.db.close()

#
# Main execution
#
nas = ThatsVeryNAS(config)

parser = argparse.ArgumentParser(description='Manage your nice NAS.')
parser.add_argument('--info', '-i', action="store_true", help='Displays info on config and files')
parser.add_argument('--addpath', '-p', action="store_true", help='adds a path to look for files')
parser.add_argument('--addexclusion_pattern', '-e',
action="store_true",help='adds an exlusion to ignore when scanning all paths')

args = parser.parse_args()

path_id=0
if (args.addpath):
    print "Enter path:",
    addpath=raw_input()
    path_id=nas.AddPath(addpath)
    if (path_id>0):
        print "Path is ID: %d" %path_id

if (args.addexclusion_pattern):
    print "Enter exclusion for %d (regex):" %path_id,
    addexclusion = raw_input();
    nas.AddExclusionPattern(addexclusion,path_id)

if (args.info):
    nas.PrintInfo()
