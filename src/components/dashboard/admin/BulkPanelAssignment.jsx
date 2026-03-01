"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import { PanelService } from '@/services/panelService';
import { toast } from 'sonner';

/**
 * CSV Parser - handles quoted values with commas
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(val => val.replace(/^["']|["']$/g, '').trim());
};

/**
 * Parse CSV content into panel ranges
 * Expected format: panel number,start range,end range
 */
const parseCSV = (csvContent) => {
  const lines = csvContent.trim().split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
  
  // Validate headers
  const panelIdx = headers.findIndex(h => h.includes('panel'));
  const startIdx = headers.findIndex(h => h.includes('start'));
  const endIdx = headers.findIndex(h => h.includes('end'));

  if (panelIdx === -1 || startIdx === -1 || endIdx === -1) {
    throw new Error('CSV must have columns: panel number, start range, end range');
  }

  const ranges = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    const panelNumber = parseInt(values[panelIdx], 10);
    const startRange = parseInt(values[startIdx], 10);
    const endRange = parseInt(values[endIdx], 10);

    if (isNaN(panelNumber) || isNaN(startRange) || isNaN(endRange)) {
      errors.push(`Row ${i + 1}: Invalid numbers`);
      continue;
    }

    if (startRange > endRange) {
      errors.push(`Row ${i + 1}: Start range (${startRange}) > End range (${endRange})`);
      continue;
    }

    ranges.push({ panelNumber, startRange, endRange, rowIndex: i + 1 });
  }

  return { ranges, errors };
};

/**
 * Aggregate ranges by panel number for preview
 */
const aggregateByPanel = (ranges) => {
  const panelStats = {};
  
  ranges.forEach(({ panelNumber, startRange, endRange }) => {
    if (!panelStats[panelNumber]) {
      panelStats[panelNumber] = {
        panelNumber,
        totalGroups: 0,
        ranges: []
      };
    }
    const groupCount = endRange - startRange + 1;
    panelStats[panelNumber].totalGroups += groupCount;
    panelStats[panelNumber].ranges.push(`${startRange}-${endRange}`);
  });

  return Object.values(panelStats).sort((a, b) => a.panelNumber - b.panelNumber);
};

export default function BulkPanelAssignment() {
  const { activeSession } = useSession();
  const [csvContent, setCSVContent] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      setCSVContent(content);
      handleParse(content);
    };
    reader.readAsText(file);
  };

  const handleParse = (content = csvContent) => {
    setResult(null);
    
    if (!content.trim()) {
      setParsedData(null);
      setParseErrors([]);
      return;
    }

    try {
      const { ranges, errors } = parseCSV(content);
      setParsedData(ranges);
      setParseErrors(errors);
      
      if (ranges.length > 0) {
        toast.success(`Parsed ${ranges.length} range(s) successfully`);
      }
    } catch (error) {
      setParsedData(null);
      setParseErrors([error.message]);
      toast.error('Failed to parse CSV', { description: error.message });
    }
  };

  const handleAssign = async () => {
    if (!activeSession?.id) {
      toast.error('No active session selected');
      return;
    }

    if (!parsedData || parsedData.length === 0) {
      toast.error('No valid data to assign');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const assignmentResult = await PanelService.bulkAssignTeamsByProjectRanges(
        activeSession.id,
        parsedData
      );
      setResult(assignmentResult);
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const panelSummary = parsedData ? aggregateByPanel(parsedData) : [];
  const totalGroups = panelSummary.reduce((sum, p) => sum + p.totalGroups, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Panel Assignment by Project Number
        </CardTitle>
        <CardDescription>
          Upload a CSV file with panel number and project number ranges to assign teams to panels.
          Format: panel number, start range, end range (inclusive)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="csv-upload">Upload CSV File</Label>
          <div className="flex gap-2">
            <Input
              id="csv-upload"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="flex-1"
            />
          </div>
        </div>

        {/* Or paste CSV */}
        <div className="space-y-2">
          <Label htmlFor="csv-content">Or Paste CSV Content</Label>
          <Textarea
            id="csv-content"
            placeholder={`panel number,start range,end range\n1,1,8\n1,129,136\n2,9,16`}
            value={csvContent}
            onChange={(e) => setCSVContent(e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleParse()}
            disabled={!csvContent.trim()}
          >
            Parse CSV
          </Button>
        </div>

        {/* Parse Errors */}
        {parseErrors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive font-medium mb-2">
              <AlertCircle className="h-4 w-4" />
              Parse Errors
            </div>
            <ul className="list-disc list-inside text-sm text-destructive/80 space-y-1">
              {parseErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview Table */}
        {panelSummary.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Preview: {panelSummary.length} Panels, {totalGroups} Total Groups</Label>
              <Badge variant="secondary">{parsedData.length} ranges parsed</Badge>
            </div>
            
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Panel #</TableHead>
                    <TableHead className="w-24">Groups</TableHead>
                    <TableHead>Ranges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panelSummary.map((panel) => (
                    <TableRow key={panel.panelNumber}>
                      <TableCell className="font-medium">
                        Panel {panel.panelNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{panel.totalGroups}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {panel.ranges.join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* Assign Button */}
        {parsedData && parsedData.length > 0 && (
          <Button 
            onClick={handleAssign} 
            disabled={isLoading || !activeSession?.id}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning Teams...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Assign {totalGroups} Groups to {panelSummary.length} Panels
              </>
            )}
          </Button>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-lg p-4 ${
            result.success 
              ? 'bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800' 
              : 'bg-destructive/10 border border-destructive/30'
          }`}>
            {result.success ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Assignment Complete
                </div>
                <ul className="text-sm text-green-600 dark:text-green-300 space-y-1">
                  <li>✓ {result.assignedCount} teams assigned</li>
                  <li>✓ {result.totalPanels} panels updated</li>
                  {result.notFoundCount > 0 && (
                    <li className="text-amber-600 dark:text-amber-400">
                      ⚠ {result.notFoundCount} project number(s) not found
                      {result.notFoundProjectNumbers?.length > 0 && (
                        <span className="block text-xs mt-1">
                          Missing: {result.notFoundProjectNumbers.join(', ')}
                          {result.notFoundCount > 20 && '...'}
                        </span>
                      )}
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{result.error}</span>
              </div>
            )}
          </div>
        )}

        {/* Session Info */}
        {!activeSession?.id && (
          <div className="text-center text-muted-foreground text-sm p-4 border border-dashed rounded-lg">
            Please select an active session to assign teams to panels
          </div>
        )}
      </CardContent>
    </Card>
  );
}
